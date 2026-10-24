<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Payment;
use App\Models\WorkOrder;
use App\Services\PaymentLedger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Billing & Accounts → Delivered vs Received (BITAC, 2026-10-24:
 * "delivered amount vs payment received er report lagbe").
 *
 * Per job, and folded per client:
 *
 *   Delivered value     the quotation's total × delivered qty ÷ ordered qty
 *   Billed              the job's bills
 *   Received            cash in from the client: bill payments net of their
 *                       deductions, security released, and advances
 *   Deducted at source  tax / VAT the client cut and paid to the treasury —
 *                       it counts as paid, though no cash came to BITAC
 *   Security held       retention the client still holds (part of the gap)
 *   Gap                 delivered value − received − deducted at source
 *
 * ⚠️ Delivered value is NOT the billed amount. A delivery is billed when
 * accounts get to it, so the two drift apart, and showing that drift is half
 * the point. Payment kinds follow PaymentLedger's rules: an applied advance is
 * not cash (the `advance` row was), a recoverable deduction is not paid.
 *
 * With a date range, each figure counts only its own events in that range —
 * deliveries by delivery date, bills by issue date, receipts by payment date —
 * so it reads "what went out and what came in, in this period". Without one it
 * is every job to date, and the gap is what is still to be collected for what
 * has been delivered. Centre-scoped, like Receivables.
 */
class DeliveryCollectionController extends Controller
{
    public function index(Request $request)
    {
        $data = $this->build($request);

        return Inertia::render('Payment/DeliveryCollection', $data + [
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** The same figures on the BITAC pad (landscape). */
    public function pdf(Request $request)
    {
        $data  = $this->build($request);
        $bytes = app(\App\Services\Reports\DeliveryCollectionSheet::class)->render($data);
        $name  = 'delivered-vs-received-' . now()->format('Y-m-d') . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json(['filename' => $name, 'size' => strlen($bytes), 'data' => base64_encode($bytes)]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('download') ? 'attachment' : 'inline') . '; filename="' . $name . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * ⚠️ The screen and the print both come through here — one loop, so a
     * printed total can never disagree with the screen's.
     */
    private function build(Request $request): array
    {
        $from   = $this->date($request->input('from'));
        $to     = $this->date($request->input('to'));
        $search = trim((string) $request->input('search'));
        $cid    = $request->integer('customer_id') ?: null;

        $inRange = function (?Carbon $at) use ($from, $to): bool {
            if (! $from && ! $to) return true;
            if (! $at) return false;
            return (! $from || $at->gte($from->copy()->startOfDay())) && (! $to || $at->lte($to->copy()->endOfDay()));
        };

        $jobs = WorkOrder::with([
                'customer:id,name', 'quotation:id,total_amount',
                'deliveryOrders' => fn ($q) => $q->where('status', 'delivered'),
                'invoices' => fn ($q) => $q->withoutGlobalScopes(),
                'payments' => fn ($q) => $q->withoutGlobalScopes()->with('deductions.type'),
            ])
            ->where('status', '!=', 'cancelled')
            ->when($cid, fn ($q) => $q->where('customer_id', $cid))
            ->where(fn ($q) => $q->whereHas('deliveryOrders', fn ($d) => $d->where('status', 'delivered'))
                ->orWhereHas('invoices')
                ->orWhereHas('payments'))
            ->get();

        $rows = [];
        foreach ($jobs as $wo) {
            $ordered  = (float) $wo->quantity;
            $contract = (float) ($wo->quotation?->total_amount ?? 0);

            $deliveries = $wo->deliveryOrders->filter(fn ($d) => $inRange($d->delivered_at));
            $dq = (float) $deliveries->sum('quantity_delivered');
            $deliveredValue = $ordered > 0 ? $contract * min($dq, $ordered) / $ordered : 0.0;

            $billed = (float) $wo->invoices->filter(fn ($i) => $inRange($i->issued_at))->sum('total_amount');

            $received = $atSource = $held = 0.0;
            foreach ($wo->payments->filter(fn ($p) => $inRange($p->paid_on ? Carbon::parse($p->paid_on) : null)) as $p) {
                if (in_array($p->kind, Payment::CASH_KINDS, true)) {
                    $received += $p->netAmount();
                }
                foreach ($p->deductions as $d) {
                    if ($d->type?->is_recoverable) {
                        if ($d->released_by_payment_id === null) $held += (float) $d->amount;
                    } else {
                        $atSource += (float) $d->amount;
                    }
                }
            }

            // Nothing happened for this job in the range — leave it out.
            if ($dq <= 0 && $billed <= 0 && $received <= 0 && $atSource <= 0) {
                continue;
            }

            $row = [
                'id'              => $wo->id,
                'job'             => $wo->job_number ? "Job {$wo->job_number}" : $wo->wo_number,
                'wo_number'       => $wo->wo_number,
                'customer_id'     => $wo->customer_id,
                'customer'        => $wo->customer?->name ?? '—',
                'ordered_qty'     => $ordered,
                'delivered_qty'   => $dq,
                'deliveries'      => $deliveries->count(),
                'contract'        => round($contract, 2),
                'delivered_value' => round($deliveredValue, 2),
                'billed'          => round($billed, 2),
                'received'        => round($received, 2),
                'at_source'       => round($atSource, 2),
                'security_held'   => round($held, 2),
            ];
            $row['gap']        = round($row['delivered_value'] - $row['received'] - $row['at_source'], 2);
            $row['not_billed'] = round(max(0, $row['delivered_value'] - $row['billed']), 2);
            // Billed beyond what has gone out — worth a look, so it is flagged.
            $row['over_billed'] = $row['billed'] - $row['delivered_value'] > PaymentLedger::TOLERANCE && $dq > 0;
            $rows[] = $row;
        }

        $rows = collect($rows);
        if ($search !== '') {
            $rows = $rows->filter(fn ($r) => stripos($r['job'] . ' ' . $r['wo_number'] . ' ' . $r['customer'], $search) !== false);
        }
        $rows = $rows->sortByDesc('gap')->values();

        $money = ['delivered_value', 'billed', 'received', 'at_source', 'security_held', 'gap', 'not_billed'];
        $clients = $rows->groupBy('customer_id')->map(function ($group) use ($money) {
            $c = ['customer_id' => $group->first()['customer_id'], 'customer' => $group->first()['customer'], 'jobs' => $group->count()];
            foreach ($money as $k) $c[$k] = round($group->sum($k), 2);
            return $c;
        })->sortByDesc('gap')->values();

        $totals = ['jobs' => $rows->count()];
        foreach ($money as $k) $totals[$k] = round($rows->sum($k), 2);

        return [
            'rows'    => $rows,
            'clients' => $clients,
            'totals'  => $totals,
            'filters' => [
                'from' => $from?->toDateString(), 'to' => $to?->toDateString(),
                'search' => $search, 'customer_id' => $cid,
                'customer' => $cid ? Customer::find($cid)?->name : null,
            ],
        ];
    }

    private function date($value): ?Carbon
    {
        try {
            return $value ? Carbon::parse($value) : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
