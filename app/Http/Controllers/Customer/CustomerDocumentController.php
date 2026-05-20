<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\QcInspection;
use App\Models\Quotation;
use App\Models\WorkOrder;
use App\Services\DeliveryChallanService;
use App\Services\InvoiceService;
use Inertia\Inertia;

/**
 * Customer Document Hub.
 *
 * Aggregates every PDF the customer might want against each of their work
 * orders — Quotation, Delivery Challan, Inspection Certificate, Invoice —
 * into a single page, and serves the PDFs via customer-scoped routes with
 * ownership checks.
 */
class CustomerDocumentController extends Controller
{
    public function index()
    {
        $customer = auth('customer')->user();

        $workOrders = WorkOrder::where('customer_id', $customer->id)
            ->with([
                'quotation:id,version,total_amount',
                'product:id,name',
                'deliveryOrders:id,work_order_id,challan_number,scheduled_date,delivered_at,status',
                'qcInspections:id,work_order_id,inspection_type,result,inspected_at',
                'invoices:id,work_order_id,invoice_number,total_amount,status,issued_at,paid_at',
            ])
            ->latest('id')
            ->get()
            ->map(function ($wo) {
                return [
                    'id'          => $wo->id,
                    'wo_number'   => $wo->wo_number,
                    'job_number'  => $wo->job_number,
                    'product'     => $wo->product->name ?? '',
                    'created_at'  => $wo->created_at->format('d M Y'),
                    'status'      => $wo->status,
                    'quotation'   => $wo->quotation ? [
                        'id'           => $wo->quotation->id,
                        'quotation_no' => 'Q-' . str_pad($wo->quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . ($wo->quotation->version ?? 1),
                    ] : null,
                    'challans'    => $wo->deliveryOrders->map(fn($d) => [
                        'id'             => $d->id,
                        'challan_number' => $d->challan_number,
                        'date'           => $d->scheduled_date?->format('d M Y') ?? '—',
                        'delivered_at'   => $d->delivered_at?->format('d M Y'),
                        'status'         => $d->status,
                    ])->values(),
                    'inspections' => $wo->qcInspections->map(fn($q) => [
                        'id'              => $q->id,
                        'inspection_type' => $q->inspection_type,
                        'result'          => $q->result,
                        'inspected_at'    => $q->inspected_at?->format('d M Y'),
                    ])->values(),
                    'invoices'    => $wo->invoices->map(fn($i) => [
                        'id'             => $i->id,
                        'invoice_number' => $i->invoice_number,
                        'total_amount'   => (float) $i->total_amount,
                        'status'         => $i->status,
                        'issued_at'      => $i->issued_at?->format('d M Y'),
                        'paid_at'        => $i->paid_at?->format('d M Y'),
                    ])->values(),
                ];
            })
            ->values();

        return Inertia::render('Customer/Documents/Index', [
            'workOrders' => $workOrders,
        ]);
    }

    /** Customer-scoped Quotation PDF — reuses QuotationController's render path. */
    public function quotation(Quotation $quotation)
    {
        $customer = auth('customer')->user();
        $quotation->load(['rfq', 'workOrder']);

        $owned = ($quotation->workOrder?->customer_id === $customer->id)
            || ($quotation->rfq?->customer_id === $customer->id);
        abort_unless($owned, 403);

        // Delegate to the staff controller's PDF method — it already streams
        // a customer-safe binary by default.
        return app(\App\Http\Controllers\QuotationController::class)
            ->pdf(request(), $quotation);
    }

    public function challan(DeliveryOrder $delivery)
    {
        $customer = auth('customer')->user();
        abort_unless($delivery->workOrder?->customer_id === $customer->id, 403);

        $bytes = app(DeliveryChallanService::class)->generatePdf($delivery);
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $delivery->challan_number . '.pdf"',
        ]);
    }

    public function inspectionCert(QcInspection $inspection)
    {
        $customer = auth('customer')->user();
        abort_unless($inspection->workOrder?->customer_id === $customer->id, 403);

        return app(\App\Http\Controllers\QcController::class)->pdf($inspection);
    }

    public function invoicePdf(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $bytes = app(InvoiceService::class)->generatePdf($invoice);
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $invoice->invoice_number . '.pdf"',
        ]);
    }
}
