<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Quotation;
use App\Support\FinancialYear;
use Illuminate\Support\Facades\DB;

/**
 * The commercial reports IED asked for. The four production reports that
 * already exist (Production, OEE, Rejection, Lead Time) look at the shop
 * floor; these look at who the work is for and what it is worth.
 *
 * Every figure is per financial year — see App\Support\FinancialYear, which
 * knows the cycle changes and that 2027-28 is only nine months.
 */
class IedReportService
{
    /**
     * "Jobs in Pipeline" — BITAC (2026-10-20): **a quotation has been given and
     * no order has come in yet.** Nothing past the order: work orders are not
     * part of this report.
     *
     * The statuses below are where a given quotation can stand while it waits.
     * `superseded` is there for the window in which a re-quotation is being
     * prepared — see pipeline(). `approved` is NOT: a quotation is approved
     * internally before it is sent, so it has not been quoted to anybody.
     * `customer_rejected` is dead and `converted` already became an order.
     */
    public const QUOTED_STATUSES = ['sent_to_customer', 'revision_requested', 'customer_accepted'];

    /** Where a waiting quotation stands, in the order the report prints them. */
    public const WAITING_STATES = [
        'sent_to_customer'   => 'Awaiting the client\'s reply',
        'revision_requested' => 'Client asked for a revision',
        'superseded'         => 'Re-quotation in preparation',
        'customer_accepted'  => 'Accepted — order not received',
    ];

    /** How long a quotation has been waiting, for follow-up. */
    public const AGEING = [
        '0_30'   => ['label' => '0–30 days',   'max' => 30],
        '31_60'  => ['label' => '31–60 days',  'max' => 60],
        '61_90'  => ['label' => '61–90 days',  'max' => 90],
        '90_up'  => ['label' => 'Over 90 days', 'max' => null],
    ];

    /**
     * A work order's date for reporting: the customer's own work-order date,
     * falling back to when it was entered for rows that predate that column.
     * Matches TargetAchievementService, so the two never disagree.
     */
    private function woDateExpr(): string
    {
        return 'COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at))';
    }

    /**
     * Every client, with how they are classified and what they brought in.
     */
    public function clients(string $year, ?int $centerId = null, ?string $search = null): array
    {
        [$start, $end] = FinancialYear::range($year);

        return Customer::query()
            ->leftJoin('sectors', 'sectors.id', '=', 'customers.sector_id')
            ->when($centerId, fn ($q) => $q->where('customers.center_id', $centerId))
            ->when($search, fn ($q, $s) => $q->where('customers.name', 'like', "%{$s}%"))
            ->leftJoin('work_orders', function ($j) use ($start, $end) {
                $j->on('work_orders.customer_id', '=', 'customers.id')
                    ->whereNotIn('work_orders.status', ['cancelled'])
                    ->whereBetween(DB::raw($this->woDateExpr()), [$start->toDateString(), $end->toDateString()]);
            })
            ->leftJoin('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->groupBy('customers.id', 'customers.name', 'customers.customer_type',
                'customers.contact_person', 'customers.phone', 'sectors.name')
            ->orderByRaw('SUM(quotations.total_amount) DESC')
            ->orderBy('customers.name')
            ->select(
                'customers.id',
                'customers.name',
                'customers.customer_type',
                'customers.contact_person',
                'customers.phone',
                DB::raw('sectors.name as sector'),
                DB::raw('COUNT(DISTINCT work_orders.id) as jobs'),
                DB::raw('COALESCE(SUM(quotations.total_amount), 0) as value'),
                DB::raw('MAX(' . $this->woDateExpr() . ') as last_job')
            )
            ->get()
            ->map(fn ($r) => [
                'id'            => $r->id,
                'name'          => $r->name,
                'customer_type' => $r->customer_type,
                'type_label'    => Customer::TYPES[$r->customer_type] ?? 'Unspecified',
                'sector'        => $r->sector ?? 'Unspecified',
                'contact'       => $r->contact_person,
                'phone'         => $r->phone,
                'jobs'          => (int) $r->jobs,
                'value'         => round((float) $r->value, 2),
                'last_job'      => $r->last_job,
            ])->all();
    }

    /**
     * Jobs grouped by customer type, then sector — the breakdown IED reports
     * upward. Unclassified customers are shown rather than hidden, so nobody
     * mistakes a gap in the data for a gap in the work.
     */
    public function bySector(string $year, ?int $centerId = null): array
    {
        [$start, $end] = FinancialYear::range($year);

        $rows = DB::table('work_orders')
            ->join('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->leftJoin('customers', 'customers.id', '=', 'work_orders.customer_id')
            ->leftJoin('sectors', 'sectors.id', '=', 'customers.sector_id')
            ->whereNotIn('work_orders.status', ['cancelled'])
            ->whereBetween(DB::raw($this->woDateExpr()), [$start->toDateString(), $end->toDateString()])
            ->when($centerId, fn ($q) => $q->where('work_orders.center_id', $centerId))
            ->groupBy('customers.customer_type', 'sectors.name')
            ->select(
                'customers.customer_type',
                DB::raw('sectors.name as sector'),
                DB::raw('COUNT(*) as jobs'),
                DB::raw('SUM(quotations.total_amount) as value')
            )
            ->get();

        // Fold into type → sectors, so the page can render it as a tree.
        $byType = [];
        foreach ($rows as $r) {
            $type = $r->customer_type ?: 'unspecified';
            $byType[$type] ??= ['type' => $type,
                'type_label' => Customer::TYPES[$type] ?? 'Unspecified',
                'jobs' => 0, 'value' => 0.0, 'sectors' => []];
            $byType[$type]['jobs']  += (int) $r->jobs;
            $byType[$type]['value'] += (float) $r->value;
            $byType[$type]['sectors'][] = [
                'sector' => $r->sector ?? 'Unspecified',
                'jobs'   => (int) $r->jobs,
                'value'  => round((float) $r->value, 2),
            ];
        }

        foreach ($byType as &$t) {
            $t['value'] = round($t['value'], 2);
            usort($t['sectors'], fn ($a, $b) => $b['value'] <=> $a['value']);
        }
        unset($t);

        usort($byType, fn ($a, $b) => $b['value'] <=> $a['value']);

        return array_values($byType);
    }

    /**
     * What was quoted in the year.
     *
     * ⚠️ **One figure per job, at the price that stands** —
     * `Quotation::applyStanding()`. After a re-quotation is given, the job is
     * counted at the re-quotation's price and the earlier version is not
     * counted at all (BITAC, 2026-10-20). While the re-quotation is still being
     * prepared, the version the customer is holding keeps counting — it used
     * to be dropped the moment the revision was started, because starting one
     * marks the parent `superseded`.
     *
     * A draft or a quotation awaiting approval was not "given" and never
     * counts. Dated by when the counted version went out, falling back to its
     * memo date and then to creation, so older rows still land somewhere.
     */
    public function quotationValue(string $year, ?int $centerId = null): array
    {
        [$start, $end] = FinancialYear::range($year);
        $dateExpr = Quotation::quotedDateSql();

        $base = DB::table('quotations')
            ->whereBetween(DB::raw($dateExpr), [$start->toDateString(), $end->toDateString()])
            ->when($centerId, fn ($q) => $q->where('quotations.center_id', $centerId));
        Quotation::applyStanding($base);

        $totals = (clone $base)
            ->select(DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_amount),0) as value'))
            ->first();

        $monthly = (clone $base)
            ->groupBy(DB::raw("DATE_FORMAT({$dateExpr}, '%Y-%m')"))
            ->orderBy(DB::raw("DATE_FORMAT({$dateExpr}, '%Y-%m')"))
            ->select(
                DB::raw("DATE_FORMAT({$dateExpr}, '%Y-%m') as month"),
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(total_amount) as value')
            )->get()
            ->map(fn ($r) => [
                'month' => $r->month,
                'label' => date('M Y', strtotime($r->month . '-01')),
                'count' => (int) $r->count,
                'value' => round((float) $r->value, 2),
            ])->all();

        // How much of it turned into work — the number IED is really asked for.
        $converted = (clone $base)->where('quotations.status', 'converted')
            ->select(DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_amount),0) as value'))
            ->first();

        return [
            'count'           => (int) $totals->count,
            'value'           => round((float) $totals->value, 2),
            'converted_count' => (int) $converted->count,
            'converted_value' => round((float) $converted->value, 2),
            'monthly'         => $monthly,
        ];
    }

    /**
     * Jobs in Pipeline: quotations given to a client against which no order
     * has come in. Not year-scoped — what is waiting is waiting, however long
     * ago it was quoted; the ageing buckets are the time dimension.
     *
     * ⚠️ **One row per job, at the version the client is holding**
     * (`Quotation::applyStanding(..., approvedCounts: false)`): the latest
     * version that actually went out. A re-quotation replaces the earlier one
     * only once it is sent; while it is being prepared the job stays here at
     * the earlier price (that version is `superseded` by then).
     *
     * ⚠️ **"No order" is checked on the RFQ, not the quotation.** A work order
     * is issued against one version, so checking only
     * `work_orders.quotation_id` would leave the other versions of the same
     * job waiting for ever. Any work order on the RFQ that was not cancelled
     * means the order came in; cancelling it puts the job back here.
     */
    public function pipeline(?int $centerId = null): array
    {
        $today = now()->startOfDay();

        $q = DB::table('quotations')
            ->leftJoin('customers', 'customers.id', '=', 'quotations.customer_id')
            ->where(fn ($w) => $w->whereIn('quotations.status', self::QUOTED_STATUSES)
                ->orWhere('quotations.status', 'superseded'))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('work_orders')
                ->whereColumn('work_orders.rfq_id', 'quotations.rfq_id')
                ->where('work_orders.status', '<>', 'cancelled'))
            ->when($centerId, fn ($q) => $q->where('quotations.center_id', $centerId));
        Quotation::applyStanding($q, 'quotations', approvedCounts: false);

        $rows = $q->select(
                'quotations.id',
                'quotations.version',
                'quotations.memo_no',
                'quotations.status',
                'quotations.rfq_id',
                'quotations.total_amount as value',
                DB::raw('customers.name as customer'),
                DB::raw(Quotation::quotedDateSql() . ' as quoted_on'),
                // What the job is: the first item on its RFQ, and how many there are.
                DB::raw('(SELECT ri.job_description FROM rfq_items ri WHERE ri.rfq_id = quotations.rfq_id ORDER BY ri.id LIMIT 1) as job'),
                DB::raw('(SELECT COUNT(*) FROM rfq_items ri WHERE ri.rfq_id = quotations.rfq_id) as item_count')
            )
            ->get()
            ->map(function ($r) use ($today) {
                $days = $r->quoted_on ? (int) \Carbon\Carbon::parse($r->quoted_on)->startOfDay()->diffInDays($today) : null;

                return [
                    'id'          => (int) $r->id,
                    'rfq_id'      => $r->rfq_id ? (int) $r->rfq_id : null,
                    'customer'    => $r->customer,
                    'job'         => $r->job ? trim(strtok($r->job, "\n")) : null,
                    'more_items'  => max(0, (int) $r->item_count - 1),
                    'state'       => $r->status,
                    'state_label' => self::WAITING_STATES[$r->status] ?? $r->status,
                    'quoted_on'   => $r->quoted_on,
                    'days'        => $days,
                    'ageing'      => self::ageingBucket($days),
                    'value'       => round((float) $r->value, 2),
                    'quotation'   => $this->quotationRef((int) $r->id, (int) $r->version, $r->memo_no, $r->status),
                ];
            })
            // Longest waiting first — this is a list to follow up from.
            ->sortByDesc(fn ($r) => $r['days'] ?? -1)
            ->values();

        $bucket = function (string $field, array $keys, callable $label) use ($rows) {
            return collect($keys)->map(fn ($k) => [
                'key'   => $k,
                'label' => $label($k),
                'jobs'  => $rows->where($field, $k)->count(),
                'value' => round($rows->where($field, $k)->sum('value'), 2),
            ])->values()->all();
        };

        return [
            'total' => [
                'jobs'        => $rows->count(),
                'value'       => round($rows->sum('value'), 2),
                'oldest_days' => $rows->max('days'),
            ],
            'by_state' => $bucket('state', array_keys(self::WAITING_STATES), fn ($k) => self::WAITING_STATES[$k]),
            'ageing'   => $bucket('ageing', array_keys(self::AGEING), fn ($k) => self::AGEING[$k]['label']),
            'jobs'     => $rows->all(),
        ];
    }

    private static function ageingBucket(?int $days): string
    {
        foreach (self::AGEING as $key => $b) {
            if ($b['max'] === null || ($days ?? 0) <= $b['max']) return $key;
        }
        return '90_up';
    }

    /** The same reference the quotation screens use, so it is recognisable. */
    private function quotationRef(int $id, int $version, ?string $memoNo, ?string $status): array
    {
        return [
            'id'      => $id,
            'ref'     => 'Q-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT),
            'version' => $version,
            'memo_no' => $memoNo,
            'status'  => $status,
        ];
    }
}
