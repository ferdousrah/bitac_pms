<?php

namespace App\Services;

use App\Models\ReworkOrder;
use App\Models\SectionHandoff;
use App\Models\SectionHandoffFile;
use App\Models\WorkOrder;
use App\Models\WorkOrderSection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Routes a Work Order through its assigned sections.
 *
 * The status machine on a WorkOrderSection (WOS):
 *   pending          → not its turn yet
 *   ready            → first WOS after PCD release, awaiting pickup
 *   in_progress      → supervisor of this section is actively working it
 *   completed        → finished cleanly; next WOS advances to in_progress
 *   awaiting_rework  → this WOS flagged a defect and is paused while
 *                      an earlier WOS reworks. Returns to in_progress
 *                      once the earlier WOS completes rework.
 *   rework           → an earlier WOS that's being reworked at the request
 *                      of a later WOS (the "flagger"). When this completes
 *                      it returns to the flagger.
 *   skipped          → manually skipped by PCD (rare).
 *
 * Every transition is logged in section_handoffs with optional attachments.
 */
class ProductionRoutingService
{
    /**
     * Mark $wos completed and advance to the next section in sequence.
     * If $wos was a rework target, control returns to the original flagger
     * instead of advancing forward.
     *
     * @param  array<UploadedFile>  $attachments
     */
    public function complete(WorkOrderSection $wos, ?string $note, array $attachments, int $userId): SectionHandoff
    {
        return DB::transaction(function () use ($wos, $note, $attachments, $userId) {
            $workOrder = $wos->workOrder;
            $sectionId = $wos->section_id;

            // If this WOS was sitting in 'rework' there may be one or more open
            // ReworkOrder rows targeting it (NCR-driven). Close them now.
            $ncrReworkCount = 0;
            if ($wos->status === 'rework') {
                $ncrReworkCount = ReworkOrder::where('target_wos_id', $wos->id)
                    ->where('status', 'open')
                    ->update(['status' => 'completed']);
            }

            // Was this a rework? Two flavours:
            //   (a) In-flow rework — a later section sent it back. There's a
            //       `flagger` WOS sitting in awaiting_rework that needs control returned.
            //   (b) NCR-driven rework — QC raised an NCR after production ended.
            //       No flagger exists; we just continue forward through the routing.
            if ($wos->status === 'rework') {
                $reworkHandoff = SectionHandoff::where('work_order_id', $workOrder->id)
                    ->where('direction', 'backward')
                    ->where('to_section_id', $sectionId)
                    ->whereNotIn('id', function ($q) {
                        $q->select('rework_for_id')->from('section_handoffs')->whereNotNull('rework_for_id');
                    })
                    ->latest('id')
                    ->first();

                $flaggerWos = $reworkHandoff && $reworkHandoff->from_section_id
                    ? WorkOrderSection::where('work_order_id', $workOrder->id)
                        ->where('section_id', $reworkHandoff->from_section_id)
                        ->where('status', 'awaiting_rework')
                        ->first()
                    : null;

                $wos->update([
                    'status'       => 'completed',
                    'completed_at' => now(),
                    'completed_by' => $userId,
                ]);

                if ($flaggerWos) {
                    // (a) in-flow rework — return to flagger
                    $flaggerWos->update(['status' => 'in_progress']);

                    $handoff = SectionHandoff::create([
                        'work_order_id'   => $workOrder->id,
                        'from_section_id' => $sectionId,
                        'to_section_id'   => $flaggerWos->section_id,
                        'direction'       => 'rework_return',
                        'note'            => $note,
                        'rework_for_id'   => $reworkHandoff?->id,
                        'transferred_by'  => $userId,
                        'transferred_at'  => now(),
                    ]);

                    $this->storeAttachments($handoff, $attachments, $userId);
                    return $handoff;
                }

                // (b) NCR-driven rework — no flagger. Fall through to the
                // standard forward path so the job continues through any
                // remaining sections and eventually returns to QC.
            }

            // Normal forward completion (also reached from NCR-driven rework above).
            // Skip update if status is already 'completed' (set by the rework branch).
            if ($wos->status !== 'completed') {
                $wos->update([
                    'status'       => 'completed',
                    'completed_at' => now(),
                    'completed_by' => $userId,
                ]);
            }

            $next = WorkOrderSection::where('work_order_id', $workOrder->id)
                ->where('sequence', '>', $wos->sequence)
                ->orderBy('sequence')
                ->first();

            // Skip past any non-production (functional, e.g. QC) sections that
            // were left in the routing by legacy work orders. QC is no longer
            // routed through Production — it lives in /qc instead.
            while ($next) {
                $next->loadMissing('section');
                if ($next->section && $next->section->type === 'production_shop') {
                    break;
                }
                $next->update(['status' => 'skipped', 'completed_at' => now()]);
                $next = WorkOrderSection::where('work_order_id', $workOrder->id)
                    ->where('sequence', '>', $next->sequence)
                    ->orderBy('sequence')
                    ->first();
            }

            if ($next) {
                $next->update(['status' => 'in_progress', 'started_at' => $next->started_at ?? now()]);
            } else {
                // Last production section finished — hand off to QC inspection.
                // The Quality module picks up WOs with status `qc_hold`.
                $workOrder->update(['status' => 'qc_hold']);
            }

            $handoff = SectionHandoff::create([
                'work_order_id'   => $workOrder->id,
                'from_section_id' => $sectionId,
                'to_section_id'   => $next?->section_id ?? $sectionId,
                'direction'       => 'forward',
                'note'            => $note,
                'transferred_by'  => $userId,
                'transferred_at'  => now(),
            ]);

            $this->storeAttachments($handoff, $attachments, $userId);
            return $handoff;
        });
    }

    /**
     * Send a job backward to an earlier section for rework.
     * The flagging section parks at `awaiting_rework` while the target
     * section's WOS flips to `rework`.
     *
     * @param  array<UploadedFile>  $attachments
     */
    public function sendBack(
        WorkOrderSection $flagger,
        WorkOrderSection $target,
        string $reason,
        array $attachments,
        int $userId,
    ): SectionHandoff {
        return DB::transaction(function () use ($flagger, $target, $reason, $attachments, $userId) {
            $flagger->update(['status' => 'awaiting_rework']);
            $target->update(['status'  => 'rework']);

            $handoff = SectionHandoff::create([
                'work_order_id'   => $flagger->work_order_id,
                'from_section_id' => $flagger->section_id,
                'to_section_id'   => $target->section_id,
                'direction'       => 'backward',
                'note'            => $reason,
                'transferred_by'  => $userId,
                'transferred_at'  => now(),
            ]);

            $this->storeAttachments($handoff, $attachments, $userId);
            return $handoff;
        });
    }

    /**
     * Persist uploaded files against a handoff.
     *
     * @param  array<UploadedFile>  $files
     */
    private function storeAttachments(SectionHandoff $handoff, array $files, int $userId): void
    {
        foreach ($files as $file) {
            if (!$file instanceof UploadedFile) continue;
            $path = $file->store('section-handoffs', 'public');
            SectionHandoffFile::create([
                'section_handoff_id' => $handoff->id,
                'uploaded_by'        => $userId,
                'stored_path'        => $path,
                'original_name'      => $file->getClientOriginalName(),
                'mime_type'          => $file->getMimeType(),
                'size_bytes'         => $file->getSize(),
            ]);
        }
    }

    /**
     * Earlier sections eligible as rework targets — anything in this WO's
     * routing with sequence < flagger.sequence and a status that has
     * already had hands on it (completed or skipped).
     *
     * @return \Illuminate\Database\Eloquent\Collection<WorkOrderSection>
     */
    public function earlierSectionsFor(WorkOrderSection $flagger)
    {
        return WorkOrderSection::with('section')
            ->where('work_order_id', $flagger->work_order_id)
            ->where('sequence', '<', $flagger->sequence)
            ->orderBy('sequence')
            ->get();
    }
}
