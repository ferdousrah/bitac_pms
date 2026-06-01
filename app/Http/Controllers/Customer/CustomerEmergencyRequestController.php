<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\EmergencyRequest;
use App\Models\WorkOrder;
use App\Services\NotifyService;
use Illuminate\Http\Request;

class CustomerEmergencyRequestController extends Controller
{
    /**
     * Customer submits an emergency-production request against one of their
     * in-progress work orders. IED reviews and approves/rejects.
     */
    public function store(Request $request, WorkOrder $workOrder)
    {
        $customer = auth('customer')->user();
        abort_unless($workOrder->customer_id === $customer->id, 403);

        // Only meaningful while the job is still in flight.
        if (in_array($workOrder->status, ['delivered', 'cancelled'], true)) {
            return back()->with('error', 'Emergency requests can only be raised while the job is still in production.');
        }

        $validated = $request->validate([
            'reason'              => 'required|string|max:1000',
            'needed_by'           => 'nullable|date|after_or_equal:today',
            'work_order_item_id'  => 'nullable|integer|exists:work_order_items,id',
        ]);

        // If a specific item is targeted, verify it belongs to this WO.
        $itemId = null;
        $itemLabel = null;
        if (! empty($validated['work_order_item_id'])) {
            $item = \App\Models\WorkOrderItem::with('product')
                ->where('id', $validated['work_order_item_id'])
                ->where('work_order_id', $workOrder->id)
                ->first();
            if (! $item) {
                return back()->with('error', 'Selected item does not belong to this work order.');
            }
            $itemId = $item->id;
            $itemLabel = $item->product?->name ?: $item->description ?: ('Job #' . $item->job_number_formatted);
        }

        // Prevent stacking pending requests on the same target (WO-wide or specific item).
        $pendingQuery = EmergencyRequest::where('work_order_id', $workOrder->id)->where('status', 'pending');
        if ($itemId) {
            $pendingQuery->where('work_order_item_id', $itemId);
        } else {
            // WO-wide request: only block if another WO-wide request is pending
            $pendingQuery->whereNull('work_order_item_id');
        }
        if ($pendingQuery->exists()) {
            return back()->with('error', 'You already have a pending emergency request for this'
                . ($itemId ? ' item.' : ' job.'));
        }

        $emergency = EmergencyRequest::create([
            'center_id'           => $workOrder->center_id,
            'work_order_id'       => $workOrder->id,
            'work_order_item_id'  => $itemId,
            'customer_id'         => $customer->id,
            'requester_name'      => $customer->contact_person ?: $customer->name,
            'requester_contact'   => $customer->phone ?: $customer->email,
            'reason'              => $validated['reason'],
            'needed_by'           => $validated['needed_by'] ?? null,
            'requested_priority'  => 'urgent',
            'status'              => 'pending',
        ]);

        // Notify IED reviewers — same permission gate as RFQ creation.
        $body = $itemLabel
            ? "{$customer->name} requested urgent production for {$itemLabel} (WO {$workOrder->wo_number})"
            : "{$customer->name} requested urgent production for {$workOrder->wo_number}";
        NotifyService::toPermission(
            'manage rfqs',
            'emergency_request',
            'Customer emergency request',
            $body,
            "/ied/emergency-requests/{$emergency->id}",
            'fi-rr-siren-on',
            'red',
        );

        return back()->with('success', 'Emergency request submitted. BITAC will review it shortly.');
    }
}
