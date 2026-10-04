<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentDeduction;
use App\Models\WorkOrder;

/**
 * What a bill, a job and a client are actually owed — the single source.
 *
 * Nothing else in the system may re-derive these figures. Three rules do all
 * the work, and every one of them has a way of being got wrong:
 *
 *  1. **A recoverable deduction does not settle the bill.** Security withheld
 *     is BITAC's money in the client's hands; it stays in the dues until a
 *     `security_release` brings it back. Tax deducted at source DOES settle,
 *     because it reached the treasury on BITAC's behalf against a challan.
 *
 *  2. **An applied advance is not cash.** `advance` was the cash; the
 *     `advance_applied` row that spends it only moves the pool. Summing both
 *     as receipts counts the same taka twice.
 *
 *  3. **`invoices.status` is derived, never typed.** It is kept as a column so
 *     lists and filters stay fast, and rewritten here after every change.
 */
class PaymentLedger
{
    /** Anything under this is rounding noise, not a debt. */
    public const TOLERANCE = 0.01;

    // ─────────────────────────────────────────────────────────────────────
    //  One bill
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @return array{billed:float,settled:float,due:float,received:float,
     *               deducted:float,security_held:float,payment_count:int,is_settled:bool}
     */
    public static function forInvoice(Invoice $invoice): array
    {
        // ⚠️ Centre scope is bypassed on purpose. CenterScope is there so a
        // Dhaka officer's LISTS show Dhaka receipts; a bill's due is a fact
        // about the money, and must not change with who is looking at it.
        $payments = $invoice->relationLoaded('payments')
            ? $invoice->payments
            : $invoice->payments()->withoutGlobalScopes()->with('deductions.type')->get();

        $settled  = 0.0;
        $received = 0.0;
        $deducted = 0.0;
        $held     = 0.0;

        foreach ($payments as $payment) {
            $settled  += $payment->settledAmount();
            $deducted += $payment->deductionTotal();

            if (in_array($payment->kind, Payment::CASH_KINDS, true)) {
                $received += $payment->netAmount();
            }

            // Only what has not been released yet is still held.
            $held += (float) $payment->deductions
                ->filter(fn ($d) => (bool) $d->type?->is_recoverable && $d->released_by_payment_id === null)
                ->sum('amount');
        }

        $billed = (float) $invoice->total_amount;
        $due    = round($billed - $settled, 2);

        return [
            'billed'        => round($billed, 2),
            'settled'       => round($settled, 2),
            'due'           => $due,
            'received'      => round($received, 2),
            'deducted'      => round($deducted, 2),
            'security_held' => round($held, 2),
            'payment_count' => $payments->count(),
            'is_settled'    => $due <= self::TOLERANCE,
        ];
    }

    /**
     * Rewrite the bill's status from its ledger.
     *
     * ⚠️ `paid` / `partially_paid` are the only two statuses this touches. A
     * bill that has had nothing against it keeps whatever the workflow set
     * (issued / sent / acknowledged) — collections must not rewind the
     * document's own history.
     */
    public static function syncInvoiceStatus(Invoice $invoice): string
    {
        $totals = self::forInvoice($invoice);

        if ($totals['is_settled'] && $totals['payment_count'] > 0) {
            $status = 'paid';
        } elseif ($totals['settled'] > self::TOLERANCE) {
            $status = 'partially_paid';
        } else {
            // Back to unpaid: if the last payment was deleted, don't leave it
            // reading paid. `sent` is the honest resting state for a bill that
            // has been issued and has nothing against it.
            $status = in_array($invoice->status, ['paid', 'partially_paid'], true)
                ? 'issued'
                : $invoice->status;
        }

        $became = $invoice->status !== $status;

        if ($became) {
            $invoice->forceFill(['status' => $status])->save();
        }

        // The client hears about a settled bill when it is really settled —
        // the one place that knows the transition happened.
        if ($became && $status === 'paid') {
            \App\Services\CustomerNotifyService::invoicePaid($invoice->fresh(['customer', 'workOrder']));
        }

        // The old one-shot columns are a read-only legacy snapshot; keep the
        // headline figure in step so anything still reading them is not lying.
        $invoice->forceFill([
            'paid_amount' => $totals['settled'] > 0 ? $totals['settled'] : null,
            'paid_at'     => $status === 'paid' ? ($invoice->paid_at ?? now()) : null,
        ])->save();

        return $status;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  One job — the advance pool lives here
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Advance taken against a job, and how much of it is still unspent.
     *
     * @return array{received:float,applied:float,available:float}
     */
    public static function advanceFor(?WorkOrder $workOrder): array
    {
        if (! $workOrder) {
            return ['received' => 0.0, 'applied' => 0.0, 'available' => 0.0];
        }

        $rows = Payment::withoutGlobalScopes()
            ->where('work_order_id', $workOrder->id)
            ->whereIn('kind', ['advance', 'advance_applied'])
            ->get(['kind', 'gross_amount']);

        $received = (float) $rows->where('kind', 'advance')->sum('gross_amount');
        $applied  = (float) $rows->where('kind', 'advance_applied')->sum('gross_amount');

        return [
            'received'  => round($received, 2),
            'applied'   => round($applied, 2),
            'available' => round($received - $applied, 2),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────
    //  One client
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @return array{billed:float,settled:float,due:float,received:float,
     *               security_held:float,advance_available:float,
     *               net_receivable:float,invoice_count:int,overdue:float}
     */
    public static function forCustomer(Customer $customer): array
    {
        $invoices = Invoice::withoutGlobalScopes()
            ->where('customer_id', $customer->id)
            ->with(['payments' => fn ($q) => $q->withoutGlobalScopes()->with('deductions.type')])
            ->get();

        $billed = $settled = $received = $held = $overdue = 0.0;

        foreach ($invoices as $invoice) {
            $t = self::forInvoice($invoice);
            $billed   += $t['billed'];
            $settled  += $t['settled'];
            $received += $t['received'];
            $held     += $t['security_held'];

            if ($t['due'] > self::TOLERANCE && self::isOverdue($invoice)) {
                $overdue += $t['due'];
            }
        }

        // Advance sitting against this client's jobs that no bill has used yet.
        $advance = Payment::withoutGlobalScopes()
            ->where('customer_id', $customer->id)
            ->whereIn('kind', ['advance', 'advance_applied'])
            ->get(['kind', 'gross_amount']);

        $advanceAvailable = round(
            (float) $advance->where('kind', 'advance')->sum('gross_amount')
            - (float) $advance->where('kind', 'advance_applied')->sum('gross_amount'),
            2,
        );

        $due = round($billed - $settled, 2);

        return [
            'billed'            => round($billed, 2),
            'settled'           => round($settled, 2),
            'due'               => $due,
            'received'          => round($received, 2),
            'security_held'     => round($held, 2),
            'advance_available' => $advanceAvailable,
            // What BITAC can really expect to collect: the dues less money
            // already in hand that no bill has drawn on yet.
            'net_receivable'    => round($due - $advanceAvailable, 2),
            'invoice_count'     => $invoices->count(),
            'overdue'           => round($overdue, 2),
        ];
    }

    /**
     * Security still in a client's hands, line by line, so a release can be
     * recorded against the exact deduction it came from.
     */
    public static function outstandingSecurityFor(Customer $customer)
    {
        return PaymentDeduction::query()
            ->outstandingSecurity()
            ->with(['type', 'payment.invoice'])
            ->whereHas('payment', fn ($p) => $p->withoutGlobalScopes()->where('customer_id', $customer->id))
            ->orderBy('id')
            ->get();
    }

    // ─────────────────────────────────────────────────────────────────────

    /**
     * ⚠️ `invoices` has no `due_date` column — the bill page's due date has
     * always rendered blank. Ageing therefore runs from the issue date plus
     * the centre's credit period, which is the only date on the record.
     */
    public const CREDIT_DAYS = 30;

    public static function dueDateFor(Invoice $invoice): ?\Carbon\Carbon
    {
        $issued = $invoice->issued_at ?? $invoice->created_at;

        return $issued ? \Carbon\Carbon::parse($issued)->addDays(self::CREDIT_DAYS) : null;
    }

    public static function isOverdue(Invoice $invoice): bool
    {
        $due = self::dueDateFor($invoice);

        return $due !== null && now()->gt($due);
    }

    /** Which ageing bucket a bill's due falls in, by days past the due date. */
    public static function ageingBucket(Invoice $invoice): string
    {
        $due = self::dueDateFor($invoice);

        if ($due === null || now()->lte($due)) {
            return 'current';
        }

        $days = $due->diffInDays(now());

        return match (true) {
            $days <= 30 => '0_30',
            $days <= 60 => '31_60',
            $days <= 90 => '61_90',
            default     => '90_plus',
        };
    }

    public const BUCKETS = ['current', '0_30', '31_60', '61_90', '90_plus'];

    public const BUCKET_LABELS = [
        'current' => 'Not due yet',
        '0_30'    => '1–30 days',
        '31_60'   => '31–60 days',
        '61_90'   => '61–90 days',
        '90_plus' => '90+ days',
    ];
}
