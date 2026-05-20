<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    public function index(Request $request)
    {
        $query = Invoice::with(['workOrder.product', 'workOrder.customer']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('workOrder.customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'total_amount', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $invoices = $query->paginate(15)->withQueryString()
            ->through(fn($i) => [
                'id'             => $i->id,
                'invoice_number' => $i->invoice_number,
                'wo_number'      => $i->workOrder->wo_number ?? '',
                'work_order_id'  => $i->work_order_id,
                'customer'       => $i->workOrder->customer->name ?? '',
                'total_amount'   => $i->total_amount,
                'status'         => $i->status,
                'issued_date'    => $i->issued_date ? \Carbon\Carbon::parse($i->issued_date)->format('d/m/Y') : null,
                'due_date'       => $i->due_date ? \Carbon\Carbon::parse($i->due_date)->format('d/m/Y') : null,
                'is_overdue'     => $i->due_date && now()->gt(\Carbon\Carbon::parse($i->due_date)) && $i->status !== 'paid',
            ]);

        return Inertia::render('Invoice/Index', [
            'invoices' => $invoices,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function show(Invoice $invoice)
    {
        $invoice->load(['workOrder.product', 'workOrder.customer', 'markedPaidBy']);

        return Inertia::render('Invoice/Show', [
            'invoice' => [
                'id'                => $invoice->id,
                'invoice_number'    => $invoice->invoice_number,
                'wo_number'         => $invoice->workOrder->wo_number ?? '',
                'job_number'        => $invoice->workOrder->job_number ?? null,
                'work_order_id'     => $invoice->work_order_id,
                'customer'          => $invoice->workOrder->customer->name ?? '',
                'customer_address'  => $invoice->workOrder->customer->address ?? '',
                'subtotal'          => $invoice->subtotal,
                'discount'          => $invoice->discount ?? 0,
                'vat_rate'          => $invoice->vat_rate,
                'vat_amount'        => $invoice->vat_amount,
                'total_amount'      => $invoice->total_amount,
                'status'            => $invoice->status,
                'issued_date'       => $invoice->issued_at?->format('d M Y'),
                'due_date'          => $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d M Y') : null,
                'payment_terms'     => $invoice->payment_terms,
                'paid_at'           => $invoice->paid_at?->format('d M Y'),
                'paid_amount'       => $invoice->paid_amount,
                'payment_method'    => $invoice->payment_method,
                'payment_reference' => $invoice->payment_reference,
                'payment_notes'     => $invoice->payment_notes,
                'marked_paid_by'    => $invoice->markedPaidBy?->name,
            ],
        ]);
    }

    /**
     * Stream the BITAC-style invoice PDF inline (browser preview).
     * `?download=1` forces a download instead.
     */
    public function downloadPdf(Request $request, Invoice $invoice)
    {
        $bytes = $this->service->generatePdf($invoice);
        $disp  = $request->boolean('download') ? 'attachment' : 'inline';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disp . '; filename="' . $invoice->invoice_number . '.pdf"',
        ]);
    }

    public function acknowledge(Invoice $invoice)
    {
        $invoice->update(['status' => 'acknowledged']);
        return back()->with('success', 'Invoice acknowledged.');
    }

    /**
     * Record customer payment against this invoice and mark it paid.
     * Captures amount, method, reference (cheque no / TX id), payment date,
     * and an optional note. Sets status='paid' and stamps marked_paid_by.
     */
    public function markPaid(Request $request, Invoice $invoice)
    {
        if ($invoice->status === 'paid') {
            return back()->with('error', 'Invoice is already marked as paid.');
        }

        $validated = $request->validate([
            'paid_amount'       => 'required|numeric|min:0.01',
            'payment_method'    => 'required|in:cash,cheque,bank_transfer,online,other',
            'payment_reference' => 'nullable|string|max:100',
            'paid_at'           => 'required|date',
            'payment_notes'     => 'nullable|string|max:500',
        ]);

        $invoice->update([
            'status'            => 'paid',
            'paid_at'           => $validated['paid_at'],
            'paid_amount'       => $validated['paid_amount'],
            'payment_method'    => $validated['payment_method'],
            'payment_reference' => $validated['payment_reference'] ?? null,
            'payment_notes'     => $validated['payment_notes'] ?? null,
            'marked_paid_by'    => auth()->id(),
        ]);

        return back()->with('success', "Invoice {$invoice->invoice_number} marked as paid.");
    }
}
