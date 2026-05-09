<?php

namespace App\Services;

use App\Models\WorkOrder;

class WorkOrderService
{
    public function generateWoNumber(): string
    {
        $year = now()->year;
        $lastWo = WorkOrder::whereYear('created_at', $year)->orderByDesc('id')->first();
        $seq = $lastWo ? ((int) substr($lastWo->wo_number, -4)) + 1 : 1;
        return 'WO-' . $year . '-' . str_pad($seq, 4, '0', STR_PAD_LEFT);
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
