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
                // Only show inspections BITAC has explicitly shared with the customer
                'qcInspections' => fn($q) => $q
                    ->where('shared_with_customer', true)
                    ->select('id', 'work_order_id', 'inspection_type', 'result', 'inspected_at', 'shared_at'),
                'invoices:id,work_order_id,invoice_number,total_amount,status,issued_at,paid_at',
                // Gate passes are linked to the RFQ rather than the WO directly.
                'rfq:id',
                'rfq.gatePasses:id,rfq_id,pass_no,direction,status,pass_date,notes,issued_at',
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
                    'gate_passes' => ($wo->rfq?->gatePasses ?? collect())->map(fn ($gp) => [
                        'id'         => $gp->id,
                        'pass_no'    => $gp->pass_no,
                        'direction'  => $gp->direction,   // 'in' | 'out'
                        'status'     => $gp->status,
                        'pass_date'  => $gp->pass_date?->format('d M Y'),
                        'issued_at'  => $gp->issued_at?->format('d M Y'),
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
        // Customer can only view if BITAC has explicitly shared this certificate.
        abort_unless((bool) $inspection->shared_with_customer, 403, 'This inspection certificate has not been shared.');

        return app(\App\Http\Controllers\QcController::class)->pdf($inspection);
    }

    /**
     * Customer-scoped Gate Pass PDF.
     * Used when IED auto-issues a Gate-In Pass against a customer complaint —
     * the customer needs to print/show it at BITAC's gate to bring the
     * defective part back. Ownership: the related complaint must belong to
     * this customer.
     */
    public function gatePass(\Illuminate\Http\Request $request, \App\Models\GatePass $gatePass)
    {
        $customer = auth('customer')->user();
        if (!$customer) abort(401, 'Not authenticated.');

        // Ownership: either the gate pass is linked to one of the customer's
        // complaints (legacy path) OR the underlying RFQ belongs to them.
        $ownedViaComplaint = \App\Models\CustomerComplaint::where('linked_gate_pass_id', $gatePass->id)
            ->where('customer_id', $customer->id)
            ->exists();
        $ownedViaRfq = $gatePass->rfq_id
            ? \App\Models\Rfq::where('id', $gatePass->rfq_id)
                ->where('customer_id', $customer->id)
                ->exists()
            : false;
        abort_unless($ownedViaComplaint || $ownedViaRfq, 403, 'This gate pass does not belong to your account.');

        // Forward through to the staff PDF generator with preview=1 OR
        // preview=base64 (JSON, used by the PdfPopupModal to bypass download
        // manager extensions like IDM/FDM that hijack application/pdf responses).
        $previewMode = $request->query('preview') === 'base64' ? 'base64' : 1;

        $fakeRequest = \Illuminate\Http\Request::create(
            '/ied/gate-passes/' . $gatePass->id . '/pdf',
            'GET',
            ['preview' => $previewMode],
        );
        return app(\App\Http\Controllers\Ied\GatePassController::class)->pdf($fakeRequest, $gatePass);
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
