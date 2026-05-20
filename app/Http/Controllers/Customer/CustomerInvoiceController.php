<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CustomerInvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    public function index(Request $request)
    {
        $customer = auth('customer')->user();

        $query = Invoice::where('customer_id', $customer->id)
            ->with(['workOrder.product']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $invoices = $query->latest('id')->paginate(15)->withQueryString()
            ->through(fn($i) => [
                'id'             => $i->id,
                'invoice_number' => $i->invoice_number,
                'wo_number'      => $i->workOrder->wo_number ?? '',
                'job_number'     => $i->workOrder->job_number ?? null,
                'product'        => $i->workOrder->product->name ?? '',
                'total_amount'   => $i->total_amount,
                'paid_amount'    => $i->paid_amount,
                'status'         => $i->status,
                'issued_date'    => $i->issued_at?->format('d M Y'),
                'paid_at'        => $i->paid_at?->format('d M Y'),
            ]);

        $totals = Invoice::where('customer_id', $customer->id)
            ->selectRaw("SUM(CASE WHEN status='paid' THEN total_amount ELSE 0 END) AS paid_sum,
                         SUM(CASE WHEN status<>'paid' THEN total_amount ELSE 0 END) AS outstanding_sum,
                         COUNT(*) AS total_count,
                         SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
                         SUM(CASE WHEN status<>'paid' THEN 1 ELSE 0 END) AS outstanding_count")
            ->first();

        return Inertia::render('Customer/Invoices/Index', [
            'invoices' => $invoices,
            'filters'  => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
            ],
            'totals'   => [
                'paid_sum'          => (float) ($totals->paid_sum ?? 0),
                'outstanding_sum'   => (float) ($totals->outstanding_sum ?? 0),
                'total_count'       => (int) ($totals->total_count ?? 0),
                'paid_count'        => (int) ($totals->paid_count ?? 0),
                'outstanding_count' => (int) ($totals->outstanding_count ?? 0),
            ],
        ]);
    }

    public function show(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $invoice->load(['workOrder.product', 'deliveryOrder']);

        return Inertia::render('Customer/Invoices/Show', [
            'invoice' => [
                'id'                => $invoice->id,
                'invoice_number'    => $invoice->invoice_number,
                'wo_number'         => $invoice->workOrder->wo_number ?? '',
                'job_number'        => $invoice->workOrder->job_number ?? null,
                'work_order_id'     => $invoice->work_order_id,
                'product'           => $invoice->workOrder->product->name ?? '',
                'quantity'          => $invoice->workOrder->quantity ?? null,
                'challan_number'    => $invoice->deliveryOrder->challan_number ?? null,
                'subtotal'          => $invoice->subtotal,
                'discount'          => $invoice->discount ?? 0,
                'vat_amount'        => $invoice->vat_amount,
                'vat_rate'          => (float) config('app.vat_rate', 15),
                'total_amount'      => $invoice->total_amount,
                'status'            => $invoice->status,
                'issued_date'       => $invoice->issued_at?->format('d M Y'),
                'due_date'          => $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d M Y') : null,
                'payment_terms'     => $invoice->payment_terms,
                'paid_at'           => $invoice->paid_at?->format('d M Y'),
                'paid_amount'       => $invoice->paid_amount,
                'payment_method'    => $invoice->payment_method,
                'payment_reference' => $invoice->payment_reference,
            ],
        ]);
    }

    public function pdf(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $bytes = $this->service->generatePdf($invoice);
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $invoice->invoice_number . '.pdf"',
        ]);
    }

    public function download(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        // First open by customer flips it to acknowledged (audit trail).
        if ($invoice->status === 'issued') {
            $invoice->update(['status' => 'acknowledged']);
        }

        $bytes = $this->service->generatePdf($invoice);
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $invoice->invoice_number . '.pdf"',
        ]);
    }
}
