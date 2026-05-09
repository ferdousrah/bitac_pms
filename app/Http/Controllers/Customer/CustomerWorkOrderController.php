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
            ->with('product')
            ->latest()->paginate(20)
            ->through(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'product'      => $wo->product->name ?? '',
                'quantity'     => $wo->quantity,
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
            ]);

        return Inertia::render('Customer/WorkOrders/Index', ['workOrders' => $workOrders]);
    }

    public function show(WorkOrder $workOrder)
    {
        $customer = auth('customer')->user();
        abort_unless($workOrder->customer_id === $customer->id, 403);

        $workOrder->load(['product', 'deliveryOrders', 'invoices']);

        $delivery = $workOrder->deliveryOrders->where('status', 'delivered')->first()
            ?? $workOrder->deliveryOrders->first();

        $invoice = $workOrder->invoices->first();

        return Inertia::render('Customer/WorkOrders/Show', [
            'workOrder' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'product'    => $workOrder->product->name ?? '',
                'quantity'   => $workOrder->quantity,
                'status'     => $workOrder->status,
                'priority'   => $workOrder->priority,
                'due_date'   => $workOrder->due_date?->format('d/m/Y'),
                'created_at' => $workOrder->created_at->format('d/m/Y'),
                'notes'      => $workOrder->notes,
                'is_overdue' => $workOrder->due_date && now()->gt($workOrder->due_date) && $workOrder->status !== 'delivered',
                'delivery'   => $delivery ? [
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
