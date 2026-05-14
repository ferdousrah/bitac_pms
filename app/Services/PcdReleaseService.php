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
 * Once all three are done, the WO transitions from `pcd_pending` to `released_to_shops`,
 * and the first section in the sequence is marked `ready` so shop in-charge can pick it up.
 */
class PcdReleaseService
{
    /**
     * Check if all PCD activities are complete and release if so.
     */
    public static function tryRelease(WorkOrder $workOrder): bool
    {
        $progress = $workOrder->pcd_progress;
        if (!$progress['all_done']) {
            return false;
        }

        if ($workOrder->released_to_shops_at) {
            return true; // Already released
        }

        // Mark first section as `ready` (others stay `pending`)
        $first = $workOrder->sections()->orderBy('sequence')->first();
        if ($first) {
            $first->update(['status' => 'ready']);
        }

        $workOrder->update([
            'status'               => 'released_to_shops',
            'released_to_shops_at' => now(),
            'released_by'          => auth()->id(),
        ]);

        // Notify shop in-charges of the first section
        if ($first && $first->section) {
            NotifyService::toPermission(
                'view shop-inbox',
                'job_released_to_shop',
                'New Job for ' . $first->section->name,
                "Job #{$workOrder->job_number} ({$workOrder->wo_number}) is ready for production.",
                "/work-orders/{$workOrder->id}",
                'fi-rr-tools',
                'green',
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

        return [
            'material_requisition' => [
                'done'  => $progress['mr'],
                'label' => 'Material Requisition',
                'icon'  => 'fi-rr-clipboard-list',
            ],
            'section_assign' => [
                'done'  => $progress['sections'],
                'label' => 'Work Order', // PCD's internal routing slip — sequential shop list
                'icon'  => 'fi-rr-sitemap',
                'count' => $sectionsCount,
            ],
            'operation_sheet' => [
                'done'  => $progress['op_sheet'],
                'label' => 'Operation Sheet',
                'icon'  => 'fi-rr-document',
            ],
            'all_done'  => $progress['all_done'],
            'released'  => $workOrder->released_to_shops_at !== null,
        ];
    }
}
