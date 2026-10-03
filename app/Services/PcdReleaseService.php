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
 */
class PcdReleaseService
{
    /**
     * Planning is finished — send the job up for release approval.
     *
     * Called from every screen that can complete a gate (MR, routing, op
     * sheet). It is **idempotent**: a job already waiting on approval, or
     * already on the shop floor, is left alone, so the five call sites cannot
     * bounce it around or notify twice.
     */
    public static function tryRelease(WorkOrder $workOrder): bool
    {
        $progress = $workOrder->pcd_progress;
        if (!$progress['all_done']) {
            return false;
        }

        if ($workOrder->released_to_shops_at || $workOrder->status === 'pcd_release_pending') {
            return true; // already released, or already waiting on the নির্বাহী প্রকৌশলী
        }

        $workOrder->update([
            'status'               => 'pcd_release_pending',
            'release_requested_at' => now(),
        ]);

        NotifyService::toPermission(
            'review pcd-inbox',
            'job_awaiting_release_approval',
            'Job ready for release — your approval needed',
            "Job #{$workOrder->job_number} ({$workOrder->wo_number}) has been planned and is waiting to be released to the shops.",
            "/pcd/inbox/release/{$workOrder->id}",
            'fi-rr-shield-check',
            'brand',
            centerId: $workOrder->center_id,
        );

        return true;
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
        ];
    }
}
