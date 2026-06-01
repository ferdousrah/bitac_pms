<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use Inertia\Inertia;

class CustomerWorkOrderController extends Controller
{
    public function index()
    {
        $customer = auth('customer')->user();
        $workOrders = WorkOrder::where('customer_id', $customer->id)
            ->with(['product', 'operationSheets.steps', 'items.product'])
            ->latest()->paginate(20)
            ->through(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'product'      => $wo->items->count() > 1
                                    ? ($wo->items->first()?->product?->name ?: $wo->items->first()?->description ?: $wo->product?->name ?: '')
                                    : ($wo->product?->name ?? ''),
                'item_count'   => $wo->items->count(),
                'quantity'     => $wo->quantity,
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
                'progress_pct' => $wo->production_progress,
            ]);

        return Inertia::render('Customer/WorkOrders/Index', ['workOrders' => $workOrders]);
    }

    public function show(WorkOrder $workOrder)
    {
        $customer = auth('customer')->user();
        abort_unless($workOrder->customer_id === $customer->id, 403);

        $workOrder->load(['product', 'deliveryOrders', 'invoices', 'operationSheets.steps.operation', 'items.product', 'rfq.gatePasses']);

        $delivery = $workOrder->deliveryOrders->where('status', 'delivered')->first()
            ?? $workOrder->deliveryOrders->first();

        $invoice = $workOrder->invoices->first();

        $allEmergencies = \App\Models\EmergencyRequest::where('work_order_id', $workOrder->id)
            ->latest()->get();
        $pendingEmergency = $allEmergencies->where('status', 'pending')->first();
        $latestEmergency  = $allEmergencies->first();

        // Map of pending requests keyed by item id (or '_wo' for WO-wide).
        $pendingByItem = $allEmergencies->where('status', 'pending')->mapWithKeys(fn($e) => [
            ($e->work_order_item_id ?: '_wo') => true,
        ])->all();

        return Inertia::render('Customer/WorkOrders/Show', [
            'workOrder' => [
                'id'           => $workOrder->id,
                'wo_number'    => $workOrder->wo_number,
                'product'      => $workOrder->product->name ?? '',
                'quantity'     => $workOrder->quantity,
                'status'       => $workOrder->status,
                'priority'     => $workOrder->priority,
                'due_date'     => $workOrder->due_date?->format('d/m/Y'),
                'created_at'   => $workOrder->created_at->format('d/m/Y'),
                'notes'        => $workOrder->notes,
                'is_overdue'   => $workOrder->due_date && now()->gt($workOrder->due_date) && $workOrder->status !== 'delivered',
                'progress_pct' => $workOrder->production_progress,
                'priority'     => $workOrder->priority,
                'steps'        => $workOrder->progressStepsSummary(),
                'items'        => $workOrder->items->map(fn($i) => [
                    'id'                => $i->id,
                    'job_number'        => $i->job_number_formatted,
                    'product'           => $i->product?->name ?: $i->description,
                    'quantity'          => $i->quantity,
                    'unit'              => $i->unit,
                    'status'            => $i->status,
                    'description'       => $i->description,
                    'has_pending_emergency' => isset($pendingByItem[$i->id]),
                ])->values(),
                'has_wo_pending_emergency' => isset($pendingByItem['_wo']),
                'in_progress_for_emergency' => ! in_array($workOrder->status, ['delivered', 'cancelled'], true),
                'pending_emergency' => $pendingEmergency ? [
                    'id'         => $pendingEmergency->id,
                    'reason'     => $pendingEmergency->reason,
                    'needed_by'  => $pendingEmergency->needed_by?->format('d M Y'),
                    'created_at' => $pendingEmergency->created_at->format('d M Y, H:i'),
                ] : null,
                'latest_emergency' => ($latestEmergency && $latestEmergency->id !== $pendingEmergency?->id) ? [
                    'id'           => $latestEmergency->id,
                    'status'       => $latestEmergency->status,
                    'review_notes' => $latestEmergency->review_notes,
                    'reviewed_at'  => $latestEmergency->reviewed_at?->format('d M Y, H:i'),
                ] : null,
                'gate_passes'  => ($workOrder->rfq?->gatePasses ?? collect())->map(fn ($gp) => [
                    'id'         => $gp->id,
                    'pass_no'    => $gp->pass_no,
                    'direction'  => $gp->direction,
                    'status'     => $gp->status,
                    'pass_date'  => $gp->pass_date?->format('d M Y'),
                    'issued_at'  => $gp->issued_at?->format('d M Y'),
                ])->values(),
                'delivery'     => $delivery ? [
                    'challan_number' => $delivery->challan_number,
                    'delivered_at'   => $delivery->delivered_at?->format('d/m/Y H:i'),
                ] : null,
                'invoice' => $invoice ? [
                    'id'             => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount'   => $invoice->total_amount,
                ] : null,
            ],
        ]);
    }
}
