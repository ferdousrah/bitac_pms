<?php

namespace App\Services;

use App\Models\WorkOrder;
use App\Services\NotifyService;

/**
 * Manages the PCD → Shops visibility gate.
 *
 * A work order becomes visible to shops only after PCD has completed:
 *   1. Material Requisition (approved/issued)
 *   2. Section Assignment (sequential shop list)
 *   3. Operation Sheet (with at least one step)
 *
 * ⚠️ **Finishing those three no longer reaches the shops.** BITAC's rule
 * (2026-10-03): the সহকারী প্রকৌশলী plans the job, but the
 * **Executive Engineer (PCD)** reads what was planned and releases it. So the
 * checklist completing moves the work order to **`pcd_release_pending`** and
 * tells him; `approveRelease()` is what actually opens the shop floor.
 *
 * ⚠️ **Unless no one holds `review pcd-inbox` at that centre**, in which case
 * the job is released as it always was — a gate with nobody behind it must not
 * hold the work up. See `reviewerIds()`.
 */
class PcdReleaseService
{
    /**
     * The sentence to add to the planner's own flash when their save is what
     * completed the planning.
     *
     * ⚠️ The নির্বাহী প্রকৌশলী was notified from the day this gate was built,
     * but the **planner** was told nothing: they saved the op sheet, read
     * "Operation sheet created." and a green "Ready" badge, and had no way to
     * know the job had just gone up for someone else's approval. An approval
     * step nobody is told about reads as a job that has stalled.
     */
    public const SENT_FOR_APPROVAL = ' Planning is complete — the job has gone to the নির্বাহী প্রকৌশলী (PCD) for release approval.';

    /**
     * Planning is finished — send the job up for release approval.
     *
     * Called from every screen that can complete a gate (MR, routing, op
     * sheet). It is **idempotent**: a job already waiting on approval, or
     * already on the shop floor, is left alone, so the five call sites cannot
     * bounce it around or notify twice.
     *
     * ⚠️ Returns true **only when this call is what sent it up**, so a caller
     * can say so once. It used to return true for "planning is complete",
     * which on a second save would have repeated the message about something
     * that happened yesterday.
     */
    public static function tryRelease(WorkOrder $workOrder): bool
    {
        $progress = $workOrder->pcd_progress;
        if (!$progress['all_done']) {
            return false;
        }

        if ($workOrder->released_to_shops_at || $workOrder->status === 'pcd_release_pending') {
            return false; // already released, or already waiting on the নির্বাহী প্রকৌশলী
        }

        // ⚠️ **No reviewer at this centre → release as it always did.** Nobody
        // holds `review pcd-inbox` until BITAC assigns someone the
        // `Executive Engineer (PCD)` role, and parking the job at
        // `pcd_release_pending` then was a DEAD END: `NotifyService` silently
        // skips an empty fan-out, so nobody was told and nobody could release
        // it — the job simply stopped, looking planned and done. Same shape as
        // `ShopAssignment::gateActive()` and an empty quotation approval chain:
        // a gate with no one behind it must not hold the work up.
        $reviewers = static::reviewerIds($workOrder);
        if (! $reviewers) {
            static::approveRelease($workOrder);

            return false;   // nothing went up, so there is nothing to announce
        }

        $workOrder->update([
            'status'               => 'pcd_release_pending',
            'release_requested_at' => now(),
        ]);

        NotifyService::send(
            $reviewers,
            'job_awaiting_release_approval',
            'Job ready for release — your approval needed',
            "Job #{$workOrder->job_number} ({$workOrder->wo_number}) has been planned and is waiting to be released to the shops.",
            "/pcd/inbox/release/{$workOrder->id}",
            'fi-rr-shield-check',
            'brand',
        );

        return true;
    }

    /**
     * Who may release this job — the holders of `review pcd-inbox` at its
     * centre, plus anyone with no centre set.
     *
     * ⚠️ The SAME lookup decides whether the gate is live and who is notified.
     * Two copies of this rule and the job could be held up for an officer who
     * was never told about it. The centre-less are included for the reason
     * `NotifyService::toPermission` includes them: BITAC's live Executive
     * Engineer has no centre, and not reaching someone at all is the worse
     * failure.
     *
     * @return array<int>
     */
    private static function reviewerIds(WorkOrder $workOrder): array
    {
        try {
            return \App\Models\User::permission('review pcd-inbox')
                ->when($workOrder->center_id !== null, fn ($q) => $q->where(
                    fn ($w) => $w->where('center_id', $workOrder->center_id)->orWhereNull('center_id')
                ))
                ->pluck('id')->all();
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            // A deploy without the seeder. No gate rather than a stuck job.
            \Log::warning("PcdReleaseService — permission 'review pcd-inbox' does not exist; "
                . 'releasing without approval. Run the seeder + permission:cache-reset.');

            return [];
        }
    }

    /**
     * The নির্বাহী প্রকৌশলী releases the job to the shops.
     *
     * This is the act `released_to_shops_at` / `released_by` have always
     * recorded — the moment work actually reaches the floor. The first routing
     * section goes `ready` and its shop is told; the rest stay `pending` until
     * the job is transferred to them.
     */
    public static function approveRelease(WorkOrder $workOrder): bool
    {
        if ($workOrder->released_to_shops_at) {
            return true;    // already on the floor
        }

        $first = $workOrder->sections()->orderBy('sequence')->first();
        if ($first) {
            $first->update(['status' => 'ready']);
        }

        $workOrder->update([
            'status'               => 'released_to_shops',
            'released_to_shops_at' => now(),
            'released_by'          => auth()->id(),
        ]);

        if ($first && $first->section) {
            NotifyService::toPermission(
                'view shop-inbox',
                'job_released_to_shop',
                'New Job for ' . $first->section->name,
                "Job #{$workOrder->job_number} ({$workOrder->wo_number}) is ready for production.",
                "/work-orders/{$workOrder->id}",
                'fi-rr-tools',
                'green',
                centerId: $workOrder->center_id,
            );
        }

        return true;
    }

    /**
     * Returns checklist data for the PCD inbox UI.
     */
    public static function checklistFor(WorkOrder $workOrder): array
    {
        $progress = $workOrder->pcd_progress;
        $sectionsCount = $workOrder->sections()->count();

        // Item-wise op-sheet progress — how many of the WO's items have a sheet.
        $itemsTotal   = $workOrder->items()->count();
        $itemsCovered = $itemsTotal > 0
            ? max(0, $itemsTotal - $workOrder->itemsMissingOperationSheet()->count())
            : ($progress['op_sheet'] ? 1 : 0);

        return [
            'material_requisition' => [
                'done'     => $progress['mr'],
                'label'    => 'Material Requisition',
                'icon'     => 'fi-rr-clipboard-list',
                // Surfaces in JobDetail as a non-blocking step — the gate
                // releases without it; PCD can raise an MR later if needed.
                'optional' => true,
            ],
            'section_assign' => [
                'done'  => $progress['sections'],
                'label' => 'Work Order', // PCD's internal routing slip — sequential shop list
                'icon'  => 'fi-rr-sitemap',
                'count' => $sectionsCount,
            ],
            'operation_sheet' => [
                'done'           => $progress['op_sheet'],
                'label'          => 'Operation Sheet',
                'icon'           => 'fi-rr-document',
                'items_total'    => $itemsTotal,
                'items_covered'  => $itemsCovered,
            ],
            'all_done'  => $progress['all_done'],
            'released'  => $workOrder->released_to_shops_at !== null,
            // Planning is done and it is sitting with the নির্বাহী প্রকৌশলী.
            // This is a THIRD state, not "done" — the planner's screen used to
            // show the same green "Ready" for it as for a released job.
            'awaiting_release'     => $workOrder->status === 'pcd_release_pending',
            'release_requested_at' => $workOrder->release_requested_at?->format('d M Y, h:i A'),
        ];
    }
}
