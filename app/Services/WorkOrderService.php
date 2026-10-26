<?php

namespace App\Services;

use App\Models\WorkOrder;

class WorkOrderService
{
    /**
     * `WO-DHK-2026-0042` — the job's centre's own series (App\Support\DocNumber).
     * Pass the centre the work order will belong to; null = the current one.
     */
    public function generateWoNumber(?int $centerId = null): string
    {
        return \App\Support\DocNumber::next('work_orders', 'wo_number', 'WO', $centerId);
    }

    public function canTransitionTo(WorkOrder $workOrder, string $newStatus): bool
    {
        $allowedTransitions = [
            'draft'              => ['approved', 'cancelled'],
            'approved'           => ['in_production', 'cancelled'],
            'in_production'      => ['qc_hold', 'cancelled'],
            'qc_hold'            => ['qc_passed', 'in_production'],
            'qc_passed'          => ['ready_for_delivery'],
            'ready_for_delivery' => ['delivered'],
            'delivered'          => [],
            'cancelled'          => [],
        ];

        return in_array($newStatus, $allowedTransitions[$workOrder->status] ?? []);
    }

    public function transition(WorkOrder $workOrder, string $newStatus, string $notes = null): WorkOrder
    {
        $workOrder->update([
            'status' => $newStatus,
            'notes'  => $notes ?? $workOrder->notes,
        ]);

        return $workOrder->fresh();
    }
}
