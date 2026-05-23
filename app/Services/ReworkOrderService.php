<?php

namespace App\Services;

use App\Models\Ncr;
use App\Models\ReworkOrder;
use App\Models\SectionHandoff;
use App\Models\WorkOrderSection;
use Illuminate\Support\Facades\DB;

/**
 * Creates one or more Rework Orders against an NCR and pushes the work
 * back into the responsible sections' production queues.
 *
 * Extracted from NcrController::createRework so the same flow can be
 * triggered from any approval path (NCR raise, customer complaint approval,
 * QC follow-up, etc.) without duplicating the side-effects.
 */
class ReworkOrderService
{
    /**
     * @param Ncr      $ncr               The NCR these reworks belong to.
     * @param int[]    $targetSectionIds  Section IDs responsible for the defect.
     * @param array<int,string|null> $notesBySection  Keyed by section_id.
     * @param int|null $userId            User creating the reworks (auth()->id() usually).
     *
     * @return array{rework_orders: array<int,string>, target_sections: \Illuminate\Support\Collection<WorkOrderSection>}
     */
    public function createForNcr(
        Ncr $ncr,
        array $targetSectionIds,
        array $notesBySection = [],
        ?int $userId = null,
    ): array {
        $userId ??= auth()->id();

        $targetWosRows = WorkOrderSection::with('section')
            ->where('work_order_id', $ncr->work_order_id)
            ->whereIn('section_id', $targetSectionIds)
            ->orderBy('sequence')
            ->get();

        if ($targetWosRows->count() !== count($targetSectionIds)) {
            throw new \RuntimeException("Some chosen sections aren't part of this work order's routing.");
        }

        $year       = now()->year;
        $startCount = ReworkOrder::whereYear('created_at', $year)->count();
        $createdNumbers = [];

        DB::transaction(function () use ($ncr, $targetWosRows, $notesBySection, $year, $startCount, $userId, &$createdNumbers) {
            $wo    = $ncr->workOrder;
            $sheet = $wo?->operationSheets()->first();

            // Quantity hint to embed in the section's rework banner — e.g.
            // "Rework 2 of 60 units". If NCR has no affected_qty set, default
            // to the WO's full quantity.
            $qtyHint = '';
            if ($ncr->affected_qty !== null) {
                $totalQty = (int) ($wo->quantity ?? 0);
                $qtyHint  = "Rework {$ncr->affected_qty}"
                          . ($totalQty > 0 ? " of {$totalQty}" : '')
                          . " unit(s). ";
            }

            $earliestSeq = $targetWosRows->min('sequence');
            $idx = 0;

            foreach ($targetWosRows as $targetWos) {
                $idx++;
                $reworkWoNumber = 'RWK-' . $year . '-' . str_pad($startCount + $idx, 4, '0', STR_PAD_LEFT);
                $createdNumbers[] = $reworkWoNumber;

                $sectionNote = $notesBySection[$targetWos->section_id] ?? null;
                $sectionNote = is_string($sectionNote) ? trim($sectionNote) : null;
                $sectionNote = $sectionNote === '' ? null : $sectionNote;

                ReworkOrder::create([
                    'ncr_id'                 => $ncr->id,
                    'original_work_order_id' => $ncr->work_order_id,
                    'target_section_id'      => $targetWos->section_id,
                    'target_wos_id'          => $targetWos->id,
                    'rework_wo_number'       => $reworkWoNumber,
                    'status'                 => 'open',
                    'notes'                  => $sectionNote,
                    'created_by'             => $userId,
                ]);

                $targetWos->update([
                    'status'       => 'rework',
                    'completed_at' => null,
                    'completed_by' => null,
                ]);

                if ($sheet) {
                    $sheet->steps()
                        ->where('section_id', $targetWos->section_id)
                        ->update([
                            'status'       => 'pending',
                            'started_at'   => null,
                            'completed_at' => null,
                            'actual_hours' => null,
                        ]);
                }

                SectionHandoff::create([
                    'work_order_id'   => $ncr->work_order_id,
                    'from_section_id' => null,
                    'to_section_id'   => $targetWos->section_id,
                    'direction'       => 'backward',
                    'note'            => $qtyHint . 'Rework Order ' . $reworkWoNumber
                                         . ($sectionNote ? ' — ' . $sectionNote : ''),
                    'transferred_by'  => $userId,
                    'transferred_at'  => now(),
                ]);
            }

            // Reset every section AFTER the earliest chosen one (and not itself
            // chosen) so the remaining routing replays once reworks complete.
            WorkOrderSection::where('work_order_id', $ncr->work_order_id)
                ->where('sequence', '>', $earliestSeq)
                ->whereNotIn('section_id', $targetWosRows->pluck('section_id'))
                ->update([
                    'status'       => 'pending',
                    'completed_at' => null,
                    'completed_by' => null,
                ]);

            $wo?->update(['status' => 'released_to_shops']);
            $ncr->update(['status' => 'in_rework']);
        });

        return [
            'rework_orders'   => $createdNumbers,
            'target_sections' => $targetWosRows,
        ];
    }
}
