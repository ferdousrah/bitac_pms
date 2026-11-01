<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\MoneyReceipt;
use App\Services\MoneyReceiptRenderer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Billing & Accounts → Money Receipt (BITAC, 2026-11-01): a receipt for an
 * organisation that pays in cash or by cheque, printed like the receipt book.
 *
 * Reading is `view payments`, issuing / correcting / cancelling `record
 * payments`. ⚠️ A receipt book of its own — nothing here touches the payment
 * ledger, so no bill's dues move. A wrong receipt is cancelled, not deleted.
 */
class MoneyReceiptController extends Controller
{
    public function index(Request $request)
    {
        $q = MoneyReceipt::with(['invoice:id,invoice_number', 'createdBy:id,name']);

        if ($s = trim((string) $request->input('search'))) {
            $q->where(fn ($w) => $w->where('receipt_no', 'like', "%{$s}%")
                ->orWhere('payer_name', 'like', "%{$s}%")
                ->orWhere('purpose', 'like', "%{$s}%")
                ->orWhere('cheque_no', 'like', "%{$s}%"));
        }
        if ($c = $request->input('customer_id')) $q->where('customer_id', $c);
        if ($m = $request->input('method'))      $q->where('method', $m);
        if ($from = $request->input('date_from')) $q->whereDate('receipt_date', '>=', $from);
        if ($to = $request->input('date_to'))     $q->whereDate('receipt_date', '<=', $to);

        // Totals over what was really received — a cancelled receipt received nothing.
        $live  = (clone $q)->where('status', 'issued');
        $canRecord = (bool) $request->user()?->can('record payments');

        return Inertia::render('MoneyReceipt/Index', [
            'receipts' => $q->orderByDesc('receipt_date')->orderByDesc('id')
                ->paginate(20)->withQueryString()
                ->through(fn (MoneyReceipt $r) => [
                    'id'               => $r->id,
                    'receipt_no'       => $r->receipt_no,
                    'receipt_date'     => $r->receipt_date?->format('Y-m-d'),
                    'date_label'       => $r->receipt_date?->format('d M Y'),
                    'customer_id'      => $r->customer_id,
                    'payer_name'       => $r->payer_name,
                    'purpose'          => $r->purpose,
                    'method'           => $r->method,
                    'cheque_no'        => $r->cheque_no,
                    'cheque_date'      => $r->cheque_date?->format('Y-m-d'),
                    'bank_name'        => $r->bank_name,
                    'received_through' => $r->received_through,
                    'amount'           => (float) $r->amount,
                    'details'          => $r->details,
                    'invoice_id'       => $r->invoice_id,
                    'bill'             => $r->invoice?->invoice_number,
                    'status'           => $r->status,
                    'cancel_reason'    => $r->cancel_reason,
                    'entered_by'       => $r->createdBy?->name,
                    'pdf_url'          => "/billing/money-receipts/{$r->id}/pdf?preview=base64",
                    'can_edit'         => $canRecord && ! $r->isCancelled(),
                ]),
            'summary'   => [
                'total'  => (float) (clone $live)->sum('amount'),
                'cash'   => (float) (clone $live)->where('method', 'cash')->sum('amount'),
                'cheque' => (float) (clone $live)->where('method', 'cheque')->sum('amount'),
                'count'  => (clone $live)->count(),
            ],
            'filters'   => [
                'search'      => $request->input('search', ''),
                'customer_id' => $request->input('customer_id', ''),
                'method'      => $request->input('method', ''),
                'date_from'   => $request->input('date_from', ''),
                'date_to'     => $request->input('date_to', ''),
            ],
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            'invoices'  => Invoice::orderByDesc('id')->limit(1000)->get(['id', 'invoice_number', 'customer_id', 'total_amount'])
                ->map(fn ($i) => ['id' => $i->id, 'number' => $i->invoice_number, 'customer_id' => $i->customer_id,
                    'total' => (float) $i->total_amount]),
            'nextNo'    => MoneyReceipt::suggestNo(),
            'canRecord' => $canRecord,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['receipt_no'] = ($data['receipt_no'] ?? null) ?: MoneyReceipt::suggestNo();

        $receipt = MoneyReceipt::create($data + ['status' => 'issued', 'created_by' => auth()->id()]);

        return back()->with('success', "Money receipt {$receipt->receipt_no} issued — print it from the list.");
    }

    public function update(Request $request, MoneyReceipt $receipt)
    {
        if ($receipt->isCancelled()) {
            return back()->with('error', "Receipt {$receipt->receipt_no} is cancelled — it cannot be changed.");
        }
        $data = $this->validated($request, $receipt->id);
        // Clearing the number keeps the one it has.
        $data['receipt_no'] = ($data['receipt_no'] ?? null) ?: $receipt->receipt_no;
        $receipt->update($data);

        return back()->with('success', "Receipt {$receipt->receipt_no} updated.");
    }

    /** Spoilt or wrong — it stays in the book, marked cancelled, with the reason. */
    public function cancel(Request $request, MoneyReceipt $receipt)
    {
        if ($receipt->isCancelled()) {
            return back()->with('error', "Receipt {$receipt->receipt_no} is already cancelled.");
        }
        $data = $request->validate(['reason' => 'required|string|min:3|max:500']);
        $receipt->update([
            'status' => 'cancelled', 'cancel_reason' => trim($data['reason']),
            'cancelled_by' => auth()->id(), 'cancelled_at' => now(),
        ]);

        return back()->with('success', "Receipt {$receipt->receipt_no} cancelled — it stays in the book.");
    }

    public function pdf(Request $request, MoneyReceipt $receipt)
    {
        $bytes    = app(MoneyReceiptRenderer::class)->render($receipt);
        $filename = 'Money-Receipt-' . preg_replace('/[^A-Za-z0-9\-]+/', '-', $receipt->receipt_no) . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json(['filename' => $filename, 'size' => strlen($bytes), 'data' => base64_encode($bytes)]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('download') ? 'attachment' : 'inline') . '; filename="' . $filename . '"',
        ]);
    }

    private function validated(Request $request, ?int $id = null): array
    {
        $request->merge(['receipt_no' => trim((string) $request->input('receipt_no', ''))]);

        $data = $request->validate([
            'receipt_no'       => ['nullable', 'string', 'max:40', Rule::unique('money_receipts', 'receipt_no')->ignore($id)],
            'receipt_date'     => 'required|date',
            // The organisation comes from the clients; one not on the list is typed.
            'customer_id'      => 'nullable|exists:customers,id',
            'payer_name'       => 'nullable|required_without:customer_id|string|max:255',
            'purpose'          => 'required|string|max:500',
            'method'           => ['required', Rule::in(array_keys(MoneyReceipt::METHODS))],
            'cheque_no'        => 'nullable|required_if:method,cheque|string|max:60',
            'cheque_date'      => 'nullable|date',
            'bank_name'        => 'nullable|string|max:160',
            'received_through' => 'nullable|string|max:160',
            'amount'           => 'required|numeric|min:0.01|max:9999999999',
            'details'          => 'nullable|string|max:500',
            'invoice_id'       => ['nullable', Rule::exists('invoices', 'id')->where('customer_id', $request->input('customer_id'))],
        ], [
            'receipt_no.unique'           => 'Another receipt already has that number.',
            'payer_name.required_without' => 'Pick the organisation, or type its name.',
            'cheque_no.required_if'       => 'Enter the cheque number.',
            'invoice_id.exists'           => 'That bill is not one of this organisation\'s.',
        ], ['purpose' => 'purpose (বাবদ)']);

        // The name is kept as it was on the day, whatever the client is renamed to later.
        if (! empty($data['customer_id'])) {
            $data['payer_name'] = Customer::whereKey($data['customer_id'])->value('name');
        } else {
            $data['customer_id'] = null;
            $data['invoice_id']  = null;
        }
        $data['invoice_id'] = ($data['invoice_id'] ?? null) ?: null;
        if ($data['method'] === 'cash') {
            $data['cheque_no'] = $data['cheque_date'] = $data['bank_name'] = null;
        }

        return $data;
    }
}
