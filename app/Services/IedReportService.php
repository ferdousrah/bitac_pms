<?php

namespace App\Services;

use App\Models\Customer;
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
     * The pipeline in the words BITAC uses, not in internal status names.
     *
     * "Released to Shops", "QC Hold" and "Approved" are states the software
     * keeps; a manager reading a report wants the six steps the work actually
     * goes through. The order here IS the order the report prints.
     *
     * ⚠️ **`quoted` has no work-order status and never will** — a quotation
     * that has gone to the customer but produced no work order yet is not in
     * `work_orders` at all. It is counted from `quotations`, which is why this
     * report starts where IED's own work starts. See quotedRows().
     *
     * ⚠️ **Every open status must appear in exactly one stage.** `pcd_review`
     * and `pcd_release_pending` were added long after this report and nobody
     * put them in the old flat list, so a work order sitting with the
     * নির্বাহী প্রকৌশলী was simply invisible here. assertStagesCoverStatuses()
     * in the test suite is what stops that happening again.
     */
    public const PIPELINE_STAGES = [
        'quoted'        => ['label' => 'Quoted',              'statuses' => []],
        'wo_received'   => ['label' => 'Work Order Received', 'statuses' => ['draft', 'approved', 'ied_pending', 'pcd_review']],
        'planning'      => ['label' => 'Production Planning', 'statuses' => ['pcd_pending', 'pcd_release_pending']],
        'in_production' => ['label' => 'In Production',       'statuses' => ['released_to_shops', 'in_production']],
        'qc'            => ['label' => 'QC',                  'statuses' => ['qc_hold']],
        'ready'         => ['label' => 'Ready to Deliver',    'statuses' => ['qc_passed', 'ready_for_delivery', 'partially_delivered']],
    ];

    /**
     * Quotation statuses that mean "given to the customer and still live".
     *
     * ⚠️ `approved` is NOT here: a quotation is approved internally before it
     * is sent, so it has not been quoted to anybody yet. `superseded` and
     * `customer_rejected` are dead, and `converted` already became a work
     * order — counting any of them would inflate the front of the pipe.
     */
    public const QUOTED_STATUSES = ['sent_to_customer', 'revision_requested', 'customer_accepted'];

    /**
     * ⚠️ The pipeline is defined by what it EXCLUDES, not by a list of what it
     * includes.
     *
     * It used to be an explicit list of open statuses, and when `pcd_review`
     * and `pcd_release_pending` were added nobody extended it — so those work
     * orders were not merely miscategorised, they were **invisible**, and the
     * report's own headline count was wrong. Selecting by exclusion means a
     * status added tomorrow still shows up. An unmapped status lands in the
     * first stage rather than vanishing, which is the right way for a report
     * to fail; the test suite asserts that none is unmapped.
     */
    public const CLOSED_STATUSES = ['delivered', 'cancelled'];

    /** Which stage a work order's status belongs to. */
    public static function stageFor(string $status): ?string
    {
        foreach (self::PIPELINE_STAGES as $key => $stage) {
            if (in_array($status, $stage['statuses'], true)) {
                return $key;
            }
        }

        return null;
    }

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
     * ⚠️ Counts quotations that actually REACHED the customer — a draft sitting
     * in the system was not "given". Dated by when it was sent, falling back to
     * its memo date and then to creation, so older rows still land somewhere
     * sensible. Superseded versions are excluded: a revised quotation would
     * otherwise be counted twice for the same job.
     */
    public function quotationValue(string $year, ?int $centerId = null): array
    {
        [$start, $end] = FinancialYear::range($year);
        $dateExpr = 'COALESCE(DATE(quotations.sent_to_customer_at), quotations.memo_date, DATE(quotations.created_at))';

        $base = DB::table('quotations')
            ->whereNotIn('quotations.status', ['draft', 'pending_approval', 'superseded'])
            ->whereBetween(DB::raw($dateExpr), [$start->toDateString(), $end->toDateString()])
            ->when($centerId, fn ($q) => $q->where('quotations.center_id', $centerId));

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
     * Work in the pipe — everything neither delivered nor cancelled, by stage.
     * Not year-scoped: what is open is open, whenever it started.
     */
    public function pipeline(?int $centerId = null): array
    {
        $rows = $this->quotedRows($centerId)->concat($this->workOrderRows($centerId));

        // One bucket per stage, in the declared order, present even when empty
        // — a stage that disappears when nothing is in it makes the report
        // read differently from one week to the next.
        $byStage = [];
        foreach (self::PIPELINE_STAGES as $key => $stage) {
            $byStage[$key] = ['stage' => $key, 'label' => $stage['label'], 'jobs' => 0, 'value' => 0.0];
        }

        foreach ($rows as $r) {
            $byStage[$r['stage']]['jobs']++;
            $byStage[$r['stage']]['value'] += (float) $r['value'];
        }
        foreach ($byStage as &$st) $st['value'] = round($st['value'], 2);
        unset($st);

        // The table reads like the pipeline above it: by stage, then by what
        // is due soonest, with undated work last.
        $order = array_flip(array_keys(self::PIPELINE_STAGES));
        $sorted = $rows->sort(function ($a, $b) use ($order) {
            return [$order[$a['stage']], $a['due_date'] === null, (string) $a['due_date']]
               <=> [$order[$b['stage']], $b['due_date'] === null, (string) $b['due_date']];
        })->values();

        // A job still being planned may have no quotation against it yet; its
        // value is genuinely unknown, not zero, and the report says so rather
        // than quietly dragging the total down.
        $unquoted = $sorted->filter(fn ($r) => $r['quotation'] === null)->count();

        return [
            'stages' => array_values($byStage),
            'total'  => [
                'jobs'       => $sorted->count(),
                'quoted'     => $byStage['quoted']['jobs'],
                'work_orders'=> $sorted->count() - $byStage['quoted']['jobs'],
                'value'      => round($sorted->sum('value'), 2),
                'unquoted'   => $unquoted,
            ],
            'jobs' => $sorted->all(),
        ];
    }

    /**
     * Quotations given to the customer that no work order has come in against.
     *
     * ⚠️ The guard is on the **RFQ**, not on the quotation: a work order is
     * issued against one version, so checking only `work_orders.quotation_id`
     * would leave the other versions of the same job sitting in "Quoted" for
     * ever. If any live work order exists for the RFQ, the job has moved on.
     */
    private function quotedRows(?int $centerId): \Illuminate\Support\Collection
    {
        return DB::table('quotations')
            ->leftJoin('customers', 'customers.id', '=', 'quotations.customer_id')
            ->whereIn('quotations.status', self::QUOTED_STATUSES)
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('work_orders')
                ->whereColumn('work_orders.rfq_id', 'quotations.rfq_id')
                ->where('work_orders.status', '<>', 'cancelled'))
            ->when($centerId, fn ($q) => $q->where('quotations.center_id', $centerId))
            ->select(
                'quotations.id',
                'quotations.version',
                'quotations.memo_no',
                'quotations.status',
                'quotations.rfq_id',
                'quotations.total_amount as value',
                DB::raw('customers.name as customer'),
                DB::raw('COALESCE(DATE(quotations.sent_to_customer_at), quotations.memo_date, DATE(quotations.created_at)) as started')
            )
            ->get()
            ->map(fn ($r) => [
                'id'         => (int) $r->id,
                'kind'       => 'quotation',
                'stage'      => 'quoted',
                'stage_label'=> self::PIPELINE_STAGES['quoted']['label'],
                'wo_number'  => null,
                'job_number' => null,
                'rfq_id'     => $r->rfq_id ? (int) $r->rfq_id : null,
                'status'     => $r->status,
                'customer'   => $r->customer,
                // A quotation carries no delivery date — the customer has not
                // ordered yet, so there is nothing to be late for.
                'due_date'   => null,
                'started'    => $r->started,
                'value'      => round((float) $r->value, 2),
                'quotation'  => $this->quotationRef((int) $r->id, (int) $r->version, $r->memo_no, $r->status),
                'overdue'    => false,
            ]);
    }

    /** Work orders that are neither delivered nor cancelled. */
    private function workOrderRows(?int $centerId): \Illuminate\Support\Collection
    {
        $today = now()->startOfDay();

        return DB::table('work_orders')
            ->leftJoin('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->leftJoin('customers', 'customers.id', '=', 'work_orders.customer_id')
            ->whereNotIn('work_orders.status', self::CLOSED_STATUSES)
            ->when($centerId, fn ($q) => $q->where('work_orders.center_id', $centerId))
            ->select(
                'work_orders.id',
                'work_orders.wo_number',
                'work_orders.job_number',
                'work_orders.status',
                'work_orders.due_date',
                DB::raw($this->woDateExpr() . ' as started'),
                DB::raw('customers.name as customer'),
                // ⚠️ A work order carries no money of its own — the figure is
                // the quotation it was issued against. A job with NO quotation
                // must read as "not quoted", never as a quoted zero.
                DB::raw('COALESCE(quotations.total_amount, 0) as value'),
                DB::raw('work_orders.quotation_id as quotation_id'),
                DB::raw('quotations.version as quotation_version'),
                DB::raw('quotations.memo_no as quotation_memo_no'),
                DB::raw('quotations.status as quotation_status')
            )
            ->get()
            ->map(fn ($r) => [
                'id'         => (int) $r->id,
                'kind'       => 'work_order',
                'stage'      => self::stageFor($r->status) ?? 'wo_received',
                'stage_label'=> self::PIPELINE_STAGES[self::stageFor($r->status) ?? 'wo_received']['label'],
                'wo_number'  => $r->wo_number,
                'job_number' => $r->job_number,
                'rfq_id'     => null,
                'status'     => $r->status,
                'customer'   => $r->customer,
                'due_date'   => $r->due_date,
                'started'    => $r->started,
                'value'      => round((float) $r->value, 2),
                'quotation'  => $r->quotation_id
                    ? $this->quotationRef((int) $r->quotation_id, (int) $r->quotation_version,
                        $r->quotation_memo_no, $r->quotation_status)
                    : null,
                'overdue'    => $r->due_date !== null && $today->gt($r->due_date),
            ]);
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
