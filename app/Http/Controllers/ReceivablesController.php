<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentDeduction;
use App\Services\PaymentLedger;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Who owes BITAC what — Billing & Accounts → Receivables.
 *
 * Every figure here comes from App\Services\PaymentLedger, so this screen can
 * never disagree with a bill's own page. Four things are shown per client and
 * they are NOT the same number:
 *
 *   Due                what is still unsettled on their bills
 *   Security held      BITAC's money they are holding (part of the due)
 *   Advance in hand    their money BITAC is holding, no bill drawn on it yet
 *   Net receivable     Due − Advance in hand: what collection really means
 *
 * ⚠️ Deliberately NOT financial-year scoped. What is outstanding is
 * outstanding, whenever it was billed — the same reasoning as the IED
 * "Jobs in Pipeline" report. The ageing buckets are the time dimension here.
 */
class ReceivablesController extends Controller
{
    public function index(Request $request)
    {
        $onlyDue = $request->boolean('only_due', true);
        $search  = trim((string) $request->input('search'));

        $invoices = Invoice::with(['payments.deductions.type', 'customer', 'workOrder'])->get();

        $byCustomer = [];
        $ageing     = array_fill_keys(PaymentLedger::BUCKETS, 0.0);

        foreach ($invoices as $invoice) {
            $t   = PaymentLedger::forInvoice($invoice);
            $cid = $invoice->customer_id;

            $byCustomer[$cid] ??= [
                'customer_id' => $cid,
                'customer'    => $invoice->customer?->name ?? '—',
                'billed' => 0.0, 'settled' => 0.0, 'due' => 0.0,
                'received' => 0.0, 'security_held' => 0.0,
                'invoice_count' => 0, 'overdue' => 0.0,
                'ageing' => array_fill_keys(PaymentLedger::BUCKETS, 0.0),
            ];

            $row = &$byCustomer[$cid];
            $row['billed']        += $t['billed'];
            $row['settled']       += $t['settled'];
            $row['due']           += $t['due'];
            $row['received']      += $t['received'];
            $row['security_held'] += $t['security_held'];
            $row['invoice_count']++;

            if ($t['due'] > PaymentLedger::TOLERANCE) {
                $bucket = PaymentLedger::ageingBucket($invoice);
                $row['ageing'][$bucket] += $t['due'];
                $ageing[$bucket]        += $t['due'];

                if ($bucket !== 'current') {
                    $row['overdue'] += $t['due'];
                }
            }
            unset($row);
        }

        // Advance sitting against each client that no bill has drawn on yet.
        $advanceByCustomer = [];
        foreach (Payment::withoutGlobalScopes()
            ->whereIn('kind', ['advance', 'advance_applied'])
            ->get(['customer_id', 'kind', 'gross_amount']) as $p) {
            $advanceByCustomer[$p->customer_id] ??= 0.0;
            $advanceByCustomer[$p->customer_id] += $p->kind === 'advance'
                ? (float) $p->gross_amount
                : -(float) $p->gross_amount;
        }

        // A client can hold an advance with no bill raised at all, so those
        // rows have to be brought in or the money would not appear anywhere.
        foreach ($advanceByCustomer as $cid => $amount) {
            if (! isset($byCustomer[$cid]) && round($amount, 2) != 0.0) {
                $byCustomer[$cid] = [
                    'customer_id' => $cid,
                    'customer'    => Customer::withoutGlobalScopes()->find($cid)?->name ?? '—',
                    'billed' => 0.0, 'settled' => 0.0, 'due' => 0.0,
                    'received' => 0.0, 'security_held' => 0.0,
                    'invoice_count' => 0, 'overdue' => 0.0,
                    'ageing' => array_fill_keys(PaymentLedger::BUCKETS, 0.0),
                ];
            }
        }

        $rows = collect($byCustomer)->map(function ($row) use ($advanceByCustomer) {
            $advance = round($advanceByCustomer[$row['customer_id']] ?? 0.0, 2);

            return array_merge($row, [
                'billed'            => round($row['billed'], 2),
                'settled'           => round($row['settled'], 2),
                'due'               => round($row['due'], 2),
                'received'          => round($row['received'], 2),
                'security_held'     => round($row['security_held'], 2),
                'overdue'           => round($row['overdue'], 2),
                'advance_available' => $advance,
                'net_receivable'    => round($row['due'] - $advance, 2),
                'ageing'            => array_map(fn ($v) => round($v, 2), $row['ageing']),
            ]);
        })->values();

        if ($search !== '') {
            $rows = $rows->filter(fn ($r) => stripos((string) $r['customer'], $search) !== false)->values();
        }
        if ($onlyDue) {
            $rows = $rows->filter(fn ($r) =>
                abs($r['due']) > PaymentLedger::TOLERANCE
                || abs($r['advance_available']) > PaymentLedger::TOLERANCE
            )->values();
        }

        $rows = $rows->sortByDesc('due')->values();

        return Inertia::render('Payment/Receivables', [
            'rows'    => $rows,
            'filters' => ['search' => $search, 'only_due' => $onlyDue],
            'totals'  => [
                'billed'            => round($rows->sum('billed'), 2),
                'settled'           => round($rows->sum('settled'), 2),
                'due'               => round($rows->sum('due'), 2),
                'overdue'           => round($rows->sum('overdue'), 2),
                'security_held'     => round($rows->sum('security_held'), 2),
                'advance_available' => round($rows->sum('advance_available'), 2),
                'net_receivable'    => round($rows->sum('net_receivable'), 2),
            ],
            'ageing'       => array_map(fn ($v) => round($v, 2), $ageing),
            'bucketLabels' => PaymentLedger::BUCKET_LABELS,
            'creditDays'   => PaymentLedger::CREDIT_DAYS,
        ]);
    }

    /**
     * One client's ledger: bill by bill, with the security still held.
     *
     * ⚠️ Centre-scoped, like the list it is reached from. The totals are
     * derived from the SAME set of bills shown below them — calling
     * PaymentLedger::forCustomer() here would answer for every centre and the
     * drill-down would then exceed its own row on the list. (The customer
     * portal is the opposite case and deliberately uses forCustomer: a client
     * sees their whole account, wherever the work was done.)
     */
    public function show(Request $request, Customer $customer)
    {
        $invoices = Invoice::where('customer_id', $customer->id)
            ->with(['payments' => fn ($q) => $q->withoutGlobalScopes()->with('deductions.type'), 'workOrder'])
            ->orderByDesc('id')
            ->get();

        $totals = [
            'billed' => 0.0, 'settled' => 0.0, 'due' => 0.0,
            'received' => 0.0, 'security_held' => 0.0, 'overdue' => 0.0,
        ];
        foreach ($invoices as $invoice) {
            $t = PaymentLedger::forInvoice($invoice);
            $totals['billed']        += $t['billed'];
            $totals['settled']       += $t['settled'];
            $totals['due']           += $t['due'];
            $totals['received']      += $t['received'];
            $totals['security_held'] += $t['security_held'];
            if ($t['due'] > PaymentLedger::TOLERANCE && PaymentLedger::isOverdue($invoice)) {
                $totals['overdue'] += $t['due'];
            }
        }

        $advanceRows = Payment::where('customer_id', $customer->id)
            ->whereIn('kind', ['advance', 'advance_applied'])
            ->get(['kind', 'gross_amount']);
        $totals['advance_available'] = round(
            (float) $advanceRows->where('kind', 'advance')->sum('gross_amount')
            - (float) $advanceRows->where('kind', 'advance_applied')->sum('gross_amount'), 2);

        $totals = array_map(fn ($v) => round((float) $v, 2), $totals);
        $totals['net_receivable'] = round($totals['due'] - $totals['advance_available'], 2);
        $totals['invoice_count']  = $invoices->count();

        $invoiceRows = $invoices
            ->map(function (Invoice $invoice) {
                $t = PaymentLedger::forInvoice($invoice);

                return [
                    'id'             => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'wo_number'      => $invoice->workOrder?->wo_number,
                    'job_number'     => $invoice->workOrder?->job_number,
                    'issued'         => ($invoice->issued_at ?? $invoice->created_at)?->format('d M Y'),
                    'due_date'       => PaymentLedger::dueDateFor($invoice)?->format('d M Y'),
                    'status'         => $invoice->status,
                    'billed'         => $t['billed'],
                    'settled'        => $t['settled'],
                    'due'            => $t['due'],
                    'security_held'  => $t['security_held'],
                    'bucket'         => $t['due'] > PaymentLedger::TOLERANCE
                        ? PaymentLedger::ageingBucket($invoice) : null,
                    'payments'       => $invoice->payments->map(fn ($p) => PaymentController::pack($p))->all(),
                ];
            });

        // Advances with no bill drawn on them yet.
        $advances = Payment::where('customer_id', $customer->id)
            ->whereIn('kind', ['advance', 'advance_applied'])
            ->with(['workOrder', 'recordedBy', 'files', 'deductions.type'])
            ->orderByDesc('paid_on')->orderByDesc('id')
            ->get()
            ->map(fn (Payment $p) => PaymentController::pack($p));

        return Inertia::render('Payment/CustomerLedger', [
            'customer' => [
                'id'      => $customer->id,
                'name'    => $customer->name,
                'address' => $customer->address,
                'phone'   => $customer->phone,
                'email'   => $customer->email,
                'type'    => $customer->customer_type_label ?? null,
            ],
            'totals'       => $totals,
            'invoices'     => $invoiceRows,
            'advances'     => $advances,
            'security'     => PaymentLedger::outstandingSecurityFor($customer)
                ->map(fn (PaymentDeduction $d) => [
                    'id'       => $d->id,
                    'type'     => $d->type?->name,
                    'amount'   => (float) $d->amount,
                    'invoice'  => $d->payment?->invoice?->invoice_number,
                    'invoice_id' => $d->payment?->invoice_id,
                    'deducted_on' => $d->payment?->paid_on?->format('d M Y'),
                    'payment_no'  => $d->payment?->payment_no,
                ])->values(),
            'bucketLabels' => PaymentLedger::BUCKET_LABELS,
            'methods'      => Payment::METHODS,
            'can'          => [
                'record' => $request->user()?->can('record payments') ?? false,
                'delete' => $request->user()?->can('delete payments') ?? false,
            ],
        ]);
    }
}
