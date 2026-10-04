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
            ->through(function ($i) {
                $t = \App\Services\PaymentLedger::forInvoice($i);

                return [
                    'id'             => $i->id,
                    'invoice_number' => $i->invoice_number,
                    'wo_number'      => $i->workOrder->wo_number ?? '',
                    'job_number'     => $i->workOrder->job_number ?? null,
                    'product'        => $i->workOrder->product->name ?? '',
                    'total_amount'   => $i->total_amount,
                    // From the ledger, so a part payment shows as a part payment.
                    'paid_amount'    => $t['settled'],
                    'due'            => $t['due'],
                    'security_held'  => $t['security_held'],
                    'status'         => $i->status,
                    'issued_date'    => $i->issued_at?->format('d M Y'),
                    'due_date'       => \App\Services\PaymentLedger::dueDateFor($i)?->format('d M Y'),
                    'paid_at'        => $i->paid_at?->format('d M Y'),
                ];
            });

        // ⚠️ This used to be SQL that counted a whole unpaid bill as
        // outstanding. Once a client can pay in instalments that overstates
        // what they owe — a bill 90% settled would read as fully outstanding.
        // The ledger is the only thing that knows the difference.
        $ledger = \App\Services\PaymentLedger::forCustomer($customer);

        $counts = Invoice::where('customer_id', $customer->id)
            ->selectRaw("COUNT(*) AS total_count,
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
                'paid_sum'          => $ledger['settled'],
                'outstanding_sum'   => $ledger['due'],
                'billed_sum'        => $ledger['billed'],
                'security_held'     => $ledger['security_held'],
                'advance_available' => $ledger['advance_available'],
                'total_count'       => (int) ($counts->total_count ?? 0),
                'paid_count'        => (int) ($counts->paid_count ?? 0),
                'outstanding_count' => (int) ($counts->outstanding_count ?? 0),
            ],
        ]);
    }

    public function show(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $invoice->load(['workOrder.product', 'deliveryOrder']);

        $ledger = \App\Services\PaymentLedger::forInvoice($invoice);

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
                // ⚠️ `invoices` has no due_date column — derived from the
                // issue date plus the credit period, like everywhere else.
                'due_date'          => \App\Services\PaymentLedger::dueDateFor($invoice)?->format('d M Y'),
                'payment_terms'     => $invoice->payment_terms,
                'paid_at'           => $invoice->paid_at?->format('d M Y'),
                'paid_amount'       => $ledger['settled'],
                'payment_method'    => $invoice->payment_method,
                'payment_reference' => $invoice->payment_reference,
            ],
            'ledger' => $ledger,
            // Their own receipts, so they can see exactly what was credited
            // and what was deducted. Read-only; amounts only, no internals.
            'payments' => $invoice->payments()->withoutGlobalScopes()
                ->with(['deductions.type'])->get()
                ->map(fn ($p) => [
                    'payment_no' => $p->payment_no,
                    'kind_label' => $p->kind_label,
                    'paid_on'    => $p->paid_on?->format('d M Y'),
                    'gross'      => (float) $p->gross_amount,
                    'deducted'   => $p->deductionTotal(),
                    'settled'    => $p->settledAmount(),
                    'method'     => $p->method_label,
                    'reference'  => $p->reference,
                    'deductions' => $p->deductions->map(fn ($d) => [
                        'type'           => $d->type?->name,
                        'amount'         => (float) $d->amount,
                        'is_recoverable' => (bool) $d->type?->is_recoverable,
                        'released'       => $d->isReleased(),
                    ])->values(),
                ])->values(),
        ]);
    }

    public function pdf(\Illuminate\Http\Request $request, Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $bytes = $this->service->generatePdf($invoice);

        // base64 mode bypasses download-manager extensions (IDM/FDM) that
        // hijack application/pdf responses — used by the PdfPopupModal.
        if ($request->query('preview') === 'base64') {
            return response()->json([
                'data'     => base64_encode($bytes),
                'filename' => $invoice->invoice_number . '.pdf',
            ]);
        }

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
