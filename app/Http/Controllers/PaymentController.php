<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentDeduction;
use App\Models\PaymentDeductionType;
use App\Models\PaymentFile;
use App\Models\WorkOrder;
use App\Services\PaymentLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Recording what a client actually paid.
 *
 * Four kinds of row, and the rules that stop them lying to each other live
 * here and in App\Services\PaymentLedger — nowhere else:
 *
 *   advance           cash taken before a bill exists, against the job
 *   against_bill      cash settling a bill, minus whatever was deducted
 *   advance_applied   spends the advance pool on a bill; NO cash
 *   security_release  a withheld retention coming back
 *
 * ⚠️ Every refusal is a redirect + flash naming the figure that refused it,
 * never an abort() — a second click on a stale tab must read as a message.
 */
class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = Payment::with(['customer', 'invoice', 'workOrder', 'recordedBy', 'deductions.type', 'files']);

        if ($search = trim((string) $request->input('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('payment_no', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('invoice', fn ($i) => $i->where('invoice_number', 'like', "%{$search}%"));
            });
        }

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }
        if ($kind = $request->input('kind')) {
            $query->where('kind', $kind);
        }
        if ($method = $request->input('method')) {
            $query->where('method', $method);
        }
        if ($from = $request->input('date_from')) {
            $query->whereDate('paid_on', '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate('paid_on', '<=', $to);
        }

        // Headline figures for the whole filtered set, not just this page.
        // ⚠️ Only cash kinds — adding `advance_applied` would count an advance
        // once when it arrived and again when it was spent.
        $cashIds = (clone $query)->whereIn('kind', Payment::CASH_KINDS)->pluck('payments.id');
        $grossSum = (float) Payment::withoutGlobalScopes()->whereIn('id', $cashIds)->sum('gross_amount');
        $deducted = (float) PaymentDeduction::whereIn('payment_id', $cashIds)->sum('amount');

        $payments = $query->orderByDesc('paid_on')->orderByDesc('id')
            ->paginate(20)->withQueryString()
            ->through(fn (Payment $p) => $this->pack($p));

        return Inertia::render('Payment/Index', [
            'payments' => $payments,
            'filters'  => $request->only(['search', 'customer_id', 'kind', 'method', 'date_from', 'date_to']),
            'summary'  => [
                'gross'    => round($grossSum, 2),
                'deducted' => round($deducted, 2),
                'net'      => round($grossSum - $deducted, 2),
                'count'    => $payments->total(),
            ],
            'customers'      => Customer::orderBy('name')->get(['id', 'name']),
            'kinds'          => Payment::KIND_LABELS,
            'methods'        => Payment::METHODS,
            'deductionTypes' => $this->deductionTypes(),
            'suggestedNo'    => Payment::suggestNo(),
            'openWorkOrders' => $this->advanceableWorkOrders(),
            'can'            => [
                'record' => $request->user()?->can('record payments') ?? false,
                'delete' => $request->user()?->can('delete payments') ?? false,
            ],
        ]);
    }

    /**
     * Record money arriving — an advance against a job, or a payment against
     * a bill.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'kind'                           => 'required|in:advance,against_bill',
            'invoice_id'                     => 'nullable|required_if:kind,against_bill|exists:invoices,id',
            'work_order_id'                  => 'nullable|required_if:kind,advance|exists:work_orders,id',
            'payment_no'                     => 'nullable|string|max:40|unique:payments,payment_no',
            'paid_on'                        => 'required|date',
            'gross_amount'                   => 'required|numeric|min:0.01',
            'method'                         => 'required|in:' . implode(',', array_keys(Payment::METHODS)),
            'bank_branch'                    => 'nullable|string|max:160',
            'reference'                      => 'nullable|string|max:120',
            'notes'                          => 'nullable|string|max:1000',
            'deductions'                     => 'nullable|array',
            'deductions.*.deduction_type_id' => 'required|exists:payment_deduction_types,id',
            'deductions.*.amount'            => 'required|numeric|min:0',
            'deductions.*.note'              => 'nullable|string|max:255',
            'files'                          => 'nullable|array|max:6',
            'files.*'                        => 'file|max:10240|mimes:pdf,jpg,jpeg,png,webp',
            'labels'                         => 'nullable|array',
        ]);

        $invoice = isset($data['invoice_id']) ? Invoice::find($data['invoice_id']) : null;
        $workOrder = isset($data['work_order_id']) ? WorkOrder::find($data['work_order_id']) : null;

        // ⚠️ The client is derived, never taken from the request — a receipt
        // filed against the wrong client is a figure nobody can find again.
        $customerId = $invoice?->customer_id ?? $workOrder?->customer_id;
        if (! $customerId) {
            return back()->with('error', 'This payment has no client behind it — pick a bill or a job.');
        }

        $lines = $this->cleanDeductions($data['deductions'] ?? []);
        $gross = round((float) $data['gross_amount'], 2);

        if ($blocker = $this->amountBlocker($gross, $lines, $invoice)) {
            return back()->with('error', $blocker);
        }

        $payment = DB::transaction(function () use ($data, $gross, $lines, $invoice, $workOrder, $customerId, $request) {
            $payment = Payment::create([
                'center_id'     => $invoice?->center_id ?? $workOrder?->center_id,
                'customer_id'   => $customerId,
                // An advance belongs to the job; a payment against a bill
                // inherits the bill's job so the advance pool lines up.
                'work_order_id' => $workOrder?->id ?? $invoice?->work_order_id,
                'invoice_id'    => $invoice?->id,
                // ⚠️ A `nullable` field that was not sent is ABSENT from the
                // validated array, not null — reading it straight throws.
                'payment_no'    => ($data['payment_no'] ?? null) ?: Payment::suggestNo(),
                'kind'          => $data['kind'],
                'paid_on'       => $data['paid_on'],
                'gross_amount'  => $gross,
                'method'        => $data['method'],
                'bank_branch'   => $data['bank_branch'] ?? null,
                'reference'     => $data['reference'] ?? null,
                'notes'         => $data['notes'] ?? null,
                'recorded_by'   => $request->user()?->id,
            ]);

            $this->writeDeductions($payment, $lines);
            $this->storeFiles($payment, $request);

            return $payment;
        });

        if ($invoice) {
            PaymentLedger::syncInvoiceStatus($invoice->fresh());
        }

        return back()->with('success', "Payment {$payment->payment_no} recorded.");
    }

    /**
     * Spend part of a job's advance on one of its bills.
     *
     * ⚠️ No cash moves here — the cash arrived when the advance was taken. The
     * row exists so the bill shows as settled and the pool goes down by the
     * same amount; that is what stops one advance settling three bills.
     */
    public function applyAdvance(Request $request)
    {
        $data = $request->validate([
            'invoice_id' => 'required|exists:invoices,id',
            'amount'     => 'required|numeric|min:0.01',
            'paid_on'    => 'nullable|date',
            'notes'      => 'nullable|string|max:1000',
        ]);

        $invoice = Invoice::findOrFail($data['invoice_id']);
        $amount  = round((float) $data['amount'], 2);

        $advance = PaymentLedger::advanceFor($invoice->workOrder);
        if ($advance['available'] <= 0) {
            return back()->with('error', 'This job has no advance left to apply.');
        }
        if ($amount > $advance['available'] + PaymentLedger::TOLERANCE) {
            return back()->with('error', sprintf(
                'Only ৳%s of advance is left on this job.',
                number_format($advance['available'], 2),
            ));
        }

        $due = PaymentLedger::forInvoice($invoice)['due'];
        if ($amount > $due + PaymentLedger::TOLERANCE) {
            return back()->with('error', sprintf(
                'Only ৳%s is still due on this bill — apply that much or less.',
                number_format($due, 2),
            ));
        }

        $payment = Payment::create([
            'center_id'     => $invoice->center_id,
            'customer_id'   => $invoice->customer_id,
            'work_order_id' => $invoice->work_order_id,
            'invoice_id'    => $invoice->id,
            'payment_no'    => Payment::suggestNo(),
            'kind'          => 'advance_applied',
            'paid_on'       => $data['paid_on'] ?? now()->toDateString(),
            'gross_amount'  => $amount,
            'method'        => 'adjustment',
            'notes'         => $data['notes'] ?? 'Advance applied to this bill.',
            'recorded_by'   => $request->user()?->id,
        ]);

        PaymentLedger::syncInvoiceStatus($invoice->fresh());

        return back()->with('success', sprintf(
            'Applied ৳%s of advance (%s).', number_format($amount, 2), $payment->payment_no,
        ));
    }

    /**
     * A withheld retention coming back.
     *
     * One line at a time, deliberately: the release settles the bill the
     * security was cut from, and a payment row points at one bill. Releasing
     * lines from three bills in one row would have nowhere to point.
     */
    public function releaseSecurity(Request $request, PaymentDeduction $deduction)
    {
        $data = $request->validate([
            'paid_on'   => 'required|date',
            'method'    => 'required|in:' . implode(',', array_keys(Payment::METHODS)),
            'reference' => 'nullable|string|max:120',
            'notes'     => 'nullable|string|max:1000',
            'files'     => 'nullable|array|max:6',
            'files.*'   => 'file|max:10240|mimes:pdf,jpg,jpeg,png,webp',
            'labels'    => 'nullable|array',
        ]);

        $deduction->load(['type', 'payment.invoice']);

        if (! $deduction->type?->is_recoverable) {
            return back()->with('error', 'This deduction is not recoverable — there is nothing to release.');
        }
        if ($deduction->isReleased()) {
            return back()->with('error', 'This security has already been released.');
        }

        $source = $deduction->payment;
        if (! $source) {
            return back()->with('error', 'This deduction has lost the payment it came from.');
        }

        $payment = DB::transaction(function () use ($data, $deduction, $source, $request) {
            $payment = Payment::create([
                'center_id'     => $source->center_id,
                'customer_id'   => $source->customer_id,
                'work_order_id' => $source->work_order_id,
                'invoice_id'    => $source->invoice_id,
                'payment_no'    => Payment::suggestNo(),
                'kind'          => 'security_release',
                'paid_on'       => $data['paid_on'],
                'gross_amount'  => $deduction->amount,
                'method'        => $data['method'],
                'reference'     => $data['reference'] ?? null,
                'notes'         => $data['notes'] ?? null,
                'recorded_by'   => $request->user()?->id,
            ]);

            $deduction->update(['released_by_payment_id' => $payment->id]);
            $this->storeFiles($payment, $request);

            return $payment;
        });

        if ($source->invoice) {
            PaymentLedger::syncInvoiceStatus($source->invoice->fresh());
        }

        return back()->with('success', sprintf(
            'Released ৳%s of security (%s).', number_format((float) $deduction->amount, 2), $payment->payment_no,
        ));
    }

    /**
     * Unpick a payment that was keyed wrong.
     *
     * ⚠️ An advance that has already been spent cannot go — the pool would
     * read negative and the bills it settled would still read settled. Undo
     * the applications first.
     */
    public function destroy(Request $request, Payment $payment)
    {
        if ($payment->kind === 'advance') {
            $advance = PaymentLedger::advanceFor($payment->workOrder);
            if ($advance['applied'] > $advance['received'] - (float) $payment->gross_amount + PaymentLedger::TOLERANCE) {
                return back()->with('error', sprintf(
                    'This advance has ৳%s already applied to bills — remove those first.',
                    number_format($advance['applied'], 2),
                ));
            }
        }

        $invoice = $payment->invoice;
        $no      = $payment->payment_no;

        DB::transaction(function () use ($payment) {
            // The physical files go; the FK takes the rows. A security_release
            // being deleted un-stamps the deduction it released (nullOnDelete),
            // so the retention goes back to being held.
            foreach ($payment->files as $file) {
                Storage::disk('public')->delete($file->path);
            }
            $payment->delete();
        });

        if ($invoice) {
            PaymentLedger::syncInvoiceStatus($invoice->fresh());
        }

        return back()->with('success', "Payment {$no} removed.");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Shared bits — the invoice page and the work order page reuse these
    // ─────────────────────────────────────────────────────────────────────

    /** @return array<int,array<string,mixed>> */
    public static function deductionTypes(): array
    {
        return PaymentDeductionType::active()->ordered()->get()
            ->map(fn (PaymentDeductionType $t) => [
                'id'               => $t->id,
                'name'             => $t->name,
                'name_bn'          => $t->name_bn,
                'is_recoverable'   => $t->is_recoverable,
                'default_rate_pct' => $t->default_rate_pct !== null ? (float) $t->default_rate_pct : null,
            ])->values()->all();
    }

    /** One ledger row, as every screen shows it. */
    public static function pack(Payment $payment): array
    {
        return [
            'id'          => $payment->id,
            'payment_no'  => $payment->payment_no,
            'kind'        => $payment->kind,
            'kind_label'  => $payment->kind_label,
            'is_cash'     => in_array($payment->kind, Payment::CASH_KINDS, true),
            'paid_on'     => $payment->paid_on?->format('d M Y'),
            'gross'       => (float) $payment->gross_amount,
            'deducted'    => $payment->deductionTotal(),
            'net'         => $payment->netAmount(),
            'settled'     => $payment->settledAmount(),
            'method'      => $payment->method,
            'method_label' => $payment->method_label,
            'bank_branch' => $payment->bank_branch,
            'reference'   => $payment->reference,
            'notes'       => $payment->notes,
            'customer'    => $payment->customer?->name,
            'customer_id' => $payment->customer_id,
            'invoice'     => $payment->invoice?->invoice_number,
            'invoice_id'  => $payment->invoice_id,
            'wo_number'   => $payment->workOrder?->wo_number,
            'recorded_by' => $payment->recordedBy?->name,
            'deductions'  => $payment->deductions->map(fn (PaymentDeduction $d) => [
                'id'             => $d->id,
                'type'           => $d->type?->name,
                'type_bn'        => $d->type?->name_bn,
                'is_recoverable' => (bool) $d->type?->is_recoverable,
                'amount'         => (float) $d->amount,
                'note'           => $d->note,
                'released'       => $d->isReleased(),
            ])->values()->all(),
            'files' => $payment->files->map(fn (PaymentFile $f) => [
                'id'    => $f->id,
                'url'   => $f->url,
                'name'  => $f->original_name,
                'label' => $f->label,
                'is_image' => $f->isImage(),
            ])->values()->all(),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────

    /** Drop blank rows; a zero deduction is not a deduction. */
    private function cleanDeductions(array $rows): array
    {
        return array_values(array_filter($rows, fn ($r) => round((float) ($r['amount'] ?? 0), 2) > 0));
    }

    private function writeDeductions(Payment $payment, array $lines): void
    {
        foreach ($lines as $line) {
            $payment->deductions()->create([
                'deduction_type_id' => $line['deduction_type_id'],
                'amount'            => round((float) $line['amount'], 2),
                'note'              => $line['note'] ?? null,
            ]);
        }
    }

    /**
     * The two ways the numbers can be nonsense.
     *
     * Deductions bigger than the payment means negative cash; settling more
     * than is due means a bill that reads overpaid and a client ledger that
     * can never balance. An overpayment is a real thing — it goes in as an
     * advance on the job, not as an inflated figure on a bill.
     */
    private function amountBlocker(float $gross, array $lines, ?Invoice $invoice): ?string
    {
        $deducted = round(array_sum(array_map(fn ($l) => (float) $l['amount'], $lines)), 2);

        if ($deducted > $gross + PaymentLedger::TOLERANCE) {
            return sprintf(
                'The deductions (৳%s) are more than the payment itself (৳%s).',
                number_format($deducted, 2), number_format($gross, 2),
            );
        }

        if (! $invoice) {
            return null;
        }

        $types = PaymentDeductionType::whereIn('id', array_column($lines, 'deduction_type_id'))
            ->pluck('is_recoverable', 'id');

        $held = 0.0;
        foreach ($lines as $line) {
            if ($types[$line['deduction_type_id']] ?? false) {
                $held += (float) $line['amount'];
            }
        }

        $settles = round($gross - $held, 2);
        $due     = PaymentLedger::forInvoice($invoice)['due'];

        if ($settles > $due + PaymentLedger::TOLERANCE) {
            return sprintf(
                'This settles ৳%s but only ৳%s is due on %s. Record the excess as an advance on the job.',
                number_format($settles, 2), number_format($due, 2), $invoice->invoice_number,
            );
        }

        return null;
    }

    private function storeFiles(Payment $payment, Request $request): void
    {
        $labels = $request->input('labels', []);

        foreach ((array) $request->file('files', []) as $i => $file) {
            if (! $file) continue;

            $path = $file->store('payments/' . $payment->id, 'public');

            $payment->files()->create([
                'path'          => $path,
                'original_name' => $file->getClientOriginalName(),
                'label'         => $labels[$i] ?? null,
                'mime'          => $file->getClientMimeType(),
                'size'          => $file->getSize(),
                'uploaded_by'   => $request->user()?->id,
            ]);
        }
    }

    /**
     * Jobs an advance can be taken against: live work, with the money picture
     * so far, so the officer can see what is already in hand.
     */
    private function advanceableWorkOrders(): array
    {
        return WorkOrder::with('customer')
            ->whereNotIn('status', ['cancelled', 'delivered'])
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(function (WorkOrder $wo) {
                $advance = PaymentLedger::advanceFor($wo);

                return [
                    'id'        => $wo->id,
                    'wo_number' => $wo->wo_number,
                    'customer'  => $wo->customer?->name,
                    'job_number' => $wo->job_number,
                    'advance'   => $advance['received'],
                    'available' => $advance['available'],
                ];
            })->values()->all();
    }
}
