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
        $invoice->load(['workOrder.product', 'workOrder.customer']);

        return Inertia::render('Invoice/Show', [
            'invoice' => [
                'id'               => $invoice->id,
                'invoice_number'   => $invoice->invoice_number,
                'wo_number'        => $invoice->workOrder->wo_number ?? '',
                'work_order_id'    => $invoice->work_order_id,
                'customer'         => $invoice->workOrder->customer->name ?? '',
                'customer_address' => $invoice->workOrder->customer->address ?? '',
                'subtotal'         => $invoice->subtotal,
                'discount'         => $invoice->discount ?? 0,
                'vat_rate'         => $invoice->vat_rate,
                'vat_amount'       => $invoice->vat_amount,
                'total_amount'     => $invoice->total_amount,
                'status'           => $invoice->status,
                'issued_date'      => $invoice->issued_date ? \Carbon\Carbon::parse($invoice->issued_date)->format('d M Y') : null,
                'due_date'         => $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d M Y') : null,
                'payment_terms'    => $invoice->payment_terms,
            ],
        ]);
    }

    public function downloadPdf(Invoice $invoice)
    {
        return $this->service->generatePdf($invoice)->download("invoice-{$invoice->invoice_number}.pdf");
    }

    public function acknowledge(Invoice $invoice)
    {
        $invoice->update(['status' => 'acknowledged']);
        return back()->with('success', 'Invoice acknowledged.');
    }
}
