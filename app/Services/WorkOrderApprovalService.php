<?php

namespace App\Services;

use App\Models\QuotationApprovalSetting;
use App\Models\WorkOrder;
use App\Models\WorkOrderApproval;
use App\Support\ApprovalChainLabels;

/**
 * The acceptance chain a work order passes through before it reaches PCD.
 *
 * Accepting a work order used to be guarded by nothing but
 * `permission:view rfqs`, with no check on who created it — so whoever issued
 * the WO from the approved quotation could immediately accept it themselves.
 *
 * The chain is configured per centre under Admin → Approval Chain, on the
 * **Work Order Acceptance** list. It is deliberately SEPARATE from the
 * quotation chain: that quotation already passed its approvers, and putting
 * the same people on the work order is the same signature twice.
 */
class WorkOrderApprovalService
{
    /**
     * Build the chain for a freshly issued work order.
     *
     * ⚠️ No chain configured → **no rows**, and acceptance keeps working the
     * way it always did. That is on purpose: shipping this with an empty chain
     * must not freeze every work order in the inbox. BITAC turns the gate on
     * by adding approvers.
     */
    public function createApprovalChain(WorkOrder $workOrder): void
    {
        if ($workOrder->approvals()->exists()) return;

        // Follows the WORK ORDER's centre, not the session's — see
        // QuotationApprovalSetting::forCenter().
        $settings = QuotationApprovalSetting::forCenter(
            $workOrder->center_id,
            QuotationApprovalSetting::DOC_WORK_ORDER
        )->get();

        if ($settings->isEmpty()) return;

        $labels = ApprovalChainLabels::forCount($settings->count());

        foreach ($settings->values() as $i => $setting) {
            WorkOrderApproval::create([
                'work_order_id' => $workOrder->id,
                'approver_id'   => $setting->approver_id,
                'level'         => $setting->level,
                'label'         => $setting->label ?: ($labels[$i] ?? 'Level ' . $setting->level),
                'status'        => 'pending',
            ]);
        }
    }

    /**
     * Why this user may not act on the work order right now, or null if they may.
     *
     * With no chain, anyone who can reach the inbox may accept — unchanged
     * behaviour. With a chain, only the approver whose level is currently
     * pending, and only in order.
     */
    public function blockerFor(WorkOrder $workOrder, int $userId): ?string
    {
        $pending = $workOrder->pendingApproval();

        if (! $workOrder->approvals()->exists()) return null;

        if (! $pending) {
            return 'This work order has already been through its approval chain.';
        }

        if ((int) $pending->approver_id !== $userId) {
            $waitingOn = $pending->approver?->name ?? 'another approver';

            return "It is {$waitingOn}'s turn to decide on this work order"
                . ($pending->label ? " ({$pending->label})" : '') . '.';
        }

        return null;
    }
}
