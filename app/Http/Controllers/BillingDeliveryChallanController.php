<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Pcd\PcdDeliveryController;
use App\Models\Customer;
use App\Models\DeliveryOrder;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Billing & Accounts → Delivery Challans (BITAC, 2026-10-24): a client gets
 * the delivery challan, the মূসক ৬.৩ and the gate pass along with the bill, so
 * accounts need the challan copy as a PDF.
 *
 * ⚠️ A further door onto the same challan PDF (`delivery.pdf` needs
 * `view delivery`, `pcd.deliveries.challan` needs `view pcd-inbox`; accounts
 * hold neither). Same generator, same bytes. Read-only.
 */
class BillingDeliveryChallanController extends Controller
{
    public function index(Request $request)
    {
        $query = DeliveryOrder::with(['workOrder:id,wo_number,job_number,quantity,customer_id', 'workOrder.customer:id,name', 'invoice:id,delivery_order_id,invoice_number'])
            ->whereNotNull('challan_number')
            ->latest('scheduled_date')->latest('id');

        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($q) => $q->where('challan_number', 'like', "%{$search}%")
                ->orWhere('vehicle_number', 'like', "%{$search}%")
                ->orWhereHas('workOrder', fn ($w) => $w->where('wo_number', 'like', "%{$search}%")->orWhere('job_number', 'like', "%{$search}%"))
                ->orWhereHas('workOrder.customer', fn ($c) => $c->where('name', 'like', "%{$search}%")));
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($from = $request->input('date_from')) $query->whereDate('scheduled_date', '>=', $from);
        if ($to = $request->input('date_to'))     $query->whereDate('scheduled_date', '<=', $to);
        if ($cid = $request->input('customer_id')) $query->whereHas('workOrder', fn ($w) => $w->where('customer_id', $cid));
        if ($request->input('billed') === 'no')  $query->whereDoesntHave('invoice');
        if ($request->input('billed') === 'yes') $query->whereHas('invoice');

        return Inertia::render('Billing/DeliveryChallans', [
            'challans' => $query->paginate(20)->withQueryString()->through(fn (DeliveryOrder $d) => [
                'id'             => $d->id,
                'challan_number' => $d->challan_number,
                'date'           => ($d->delivered_at ?? $d->scheduled_date)?->format('d M Y'),
                'status'         => $d->status,
                'quantity'       => (float) $d->quantity_delivered,
                'ordered'        => (float) ($d->workOrder?->quantity ?? 0),
                'job'            => $d->workOrder?->job_number ? "Job {$d->workOrder->job_number}" : $d->workOrder?->wo_number,
                'customer'       => $d->workOrder?->customer?->name ?? '—',
                'vehicle_number' => $d->vehicle_number,
                'invoice'        => $d->invoice ? ['id' => $d->invoice->id, 'number' => $d->invoice->invoice_number] : null,
            ]),
            'filters' => [
                'search'      => $request->input('search', ''),
                'status'      => $request->input('status', ''),
                'date_from'   => $request->input('date_from', ''),
                'date_to'     => $request->input('date_to', ''),
                'customer_id' => $request->input('customer_id', ''),
                'billed'      => $request->input('billed', ''),
            ],
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function pdf(Request $request, DeliveryOrder $delivery)
    {
        abort_unless($delivery->challan_number, 404);

        return app(PcdDeliveryController::class)->challan($request, $delivery);
    }
}
