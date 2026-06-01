<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\EmergencyRequest;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED side of the customer emergency-production workflow.
 *
 * Customer raises a request from the customer portal → it lands here → IED
 * reviewer either approves (which flips the WO to urgent + blasts a notification
 * to production staff) or rejects with a note.
 */
class EmergencyRequestController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status', 'pending');
        $query = EmergencyRequest::with(['workOrder.product', 'workOrderItem.product', 'customer', 'reviewer'])
            ->latest();
        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }
        $requests = $query->paginate(20)->withQueryString();

        return Inertia::render('Ied/EmergencyRequests/Index', [
            'requests' => $requests->through(fn ($r) => [
                'id'                 => $r->id,
                'wo_number'          => $r->workOrder?->wo_number,
                'job_number'         => $r->workOrderItem?->job_number_formatted ?: ($r->workOrder?->job_number),
                'product'            => $r->workOrderItem?->product?->name
                                        ?: $r->workOrderItem?->description
                                        ?: $r->workOrder?->product?->name,
                'item_scope'         => $r->work_order_item_id ? 'item' : 'whole_job',
                'work_order_status'  => $r->workOrder?->status,
                'work_order_priority'=> $r->workOrder?->priority,
                'customer'           => $r->customer?->name,
                'requester_name'     => $r->requester_name,
                'requester_contact'  => $r->requester_contact,
                'reason'             => $r->reason,
                'needed_by'          => $r->needed_by?->format('d M Y'),
                'status'             => $r->status,
                'reviewer'           => $r->reviewer?->name,
                'review_notes'       => $r->review_notes,
                'reviewed_at'        => $r->reviewed_at?->format('d M Y H:i'),
                'created_at'         => $r->created_at->format('d M Y H:i'),
            ]),
            'filter'  => ['status' => $status],
            'counts'  => [
                'pending'  => EmergencyRequest::where('status', 'pending')->count(),
                'approved' => EmergencyRequest::where('status', 'approved')->count(),
                'rejected' => EmergencyRequest::where('status', 'rejected')->count(),
            ],
        ]);
    }

    public function show(EmergencyRequest $emergencyRequest)
    {
        $emergencyRequest->load(['workOrder.product', 'workOrder.customer', 'workOrderItem.product', 'customer', 'reviewer']);
        $wo = $emergencyRequest->workOrder;
        $item = $emergencyRequest->workOrderItem;

        return Inertia::render('Ied/EmergencyRequests/Show', [
            'request' => [
                'id'                 => $emergencyRequest->id,
                'status'             => $emergencyRequest->status,
                'reason'             => $emergencyRequest->reason,
                'needed_by'          => $emergencyRequest->needed_by?->format('d M Y'),
                'requester_name'     => $emergencyRequest->requester_name,
                'requester_contact'  => $emergencyRequest->requester_contact,
                'reviewer'           => $emergencyRequest->reviewer?->name,
                'review_notes'       => $emergencyRequest->review_notes,
                'reviewed_at'        => $emergencyRequest->reviewed_at?->format('d M Y H:i'),
                'created_at'         => $emergencyRequest->created_at->format('d M Y, H:i'),
                'original_priority'  => $emergencyRequest->original_priority,
                'workOrder' => $wo ? [
                    'id'         => $wo->id,
                    'wo_number'  => $wo->wo_number,
                    'job_number' => $wo->job_number,
                    'product'    => $wo->product?->name,
                    'quantity'   => $wo->quantity,
                    'status'     => $wo->status,
                    'priority'   => $wo->priority,
                    'due_date'   => $wo->due_date?->format('d M Y'),
                    'customer'   => $wo->customer?->name,
                ] : null,
                'targetItem' => $item ? [
                    'id'         => $item->id,
                    'job_number' => $item->job_number_formatted,
                    'product'    => $item->product?->name ?: $item->description,
                    'quantity'   => $item->quantity,
                    'unit'       => $item->unit,
                    'status'     => $item->status,
                ] : null,
            ],
        ]);
    }

    public function approve(Request $request, EmergencyRequest $emergencyRequest)
    {
        abort_unless($emergencyRequest->status === 'pending', 422, 'This request has already been reviewed.');

        $validated = $request->validate([
            'review_notes' => 'nullable|string|max:1000',
        ]);

        $wo = $emergencyRequest->workOrder;
        $item = $emergencyRequest->workOrderItem;
        $original = $wo?->priority;

        // Flip WO to urgent + record decision.
        if ($wo) $wo->update(['priority' => 'urgent']);

        $emergencyRequest->update([
            'status'            => 'approved',
            'reviewed_by'       => auth()->id(),
            'reviewed_at'       => now(),
            'review_notes'      => $validated['review_notes'] ?? null,
            'original_priority' => $original,
        ]);

        // Broadcast to anyone who can act on production — supervisors + operators.
        // Two permissions cover the spread without firing twice if a user has both.
        $scopeLabel = $item
            ? ("Job #{$item->job_number_formatted}" . ($item->product?->name ? ' — ' . $item->product->name : ''))
            : $wo?->wo_number;
        $title = "🚨 URGENT: {$scopeLabel}";
        $body  = $item
            ? "Emergency approved for item {$scopeLabel} under WO {$wo?->wo_number} (customer: {$emergencyRequest->customer?->name}). Speed up production."
            : "Emergency request approved for {$emergencyRequest->customer?->name}. Speed up production for {$wo?->wo_number}.";
        NotifyService::toPermission(
            'view production',
            'emergency_approved',
            $title, $body,
            "/work-orders/{$wo?->id}",
            'fi-rr-siren-on',
            'red',
        );
        NotifyService::toPermission(
            'view pcd',
            'emergency_approved',
            $title, $body,
            "/work-orders/{$wo?->id}",
            'fi-rr-siren-on',
            'red',
        );

        return redirect()->route('ied.emergency-requests.index')
            ->with('success', 'Approved — job marked URGENT and production team has been notified.');
    }

    public function reject(Request $request, EmergencyRequest $emergencyRequest)
    {
        abort_unless($emergencyRequest->status === 'pending', 422, 'This request has already been reviewed.');

        $validated = $request->validate([
            'review_notes' => 'required|string|max:1000',
        ]);

        $emergencyRequest->update([
            'status'       => 'rejected',
            'reviewed_by'  => auth()->id(),
            'reviewed_at'  => now(),
            'review_notes' => $validated['review_notes'],
        ]);

        return redirect()->route('ied.emergency-requests.index')
            ->with('success', 'Request rejected. Customer will see your note in their portal.');
    }
}
