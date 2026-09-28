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
    /** Work not finished and not abandoned — what is still in the pipe. */
    public const PIPELINE_STATUSES = [
        'draft', 'ied_pending', 'pcd_pending', 'released_to_shops', 'approved',
        'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery', 'partially_delivered',
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
        $rows = DB::table('work_orders')
            ->leftJoin('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->leftJoin('customers', 'customers.id', '=', 'work_orders.customer_id')
            ->whereIn('work_orders.status', self::PIPELINE_STATUSES)
            ->when($centerId, fn ($q) => $q->where('work_orders.center_id', $centerId))
            ->orderByRaw('work_orders.due_date IS NULL, work_orders.due_date')
            ->select(
                'work_orders.id',
                'work_orders.wo_number',
                'work_orders.job_number',
                'work_orders.status',
                'work_orders.due_date',
                DB::raw($this->woDateExpr() . ' as started'),
                DB::raw('customers.name as customer'),
                DB::raw('COALESCE(quotations.total_amount, 0) as value')
            )
            ->get();

        $byStage = [];
        foreach ($rows as $r) {
            $byStage[$r->status] ??= ['status' => $r->status, 'jobs' => 0, 'value' => 0.0];
            $byStage[$r->status]['jobs']++;
            $byStage[$r->status]['value'] += (float) $r->value;
        }
        foreach ($byStage as &$st) $st['value'] = round($st['value'], 2);
        unset($st);

        // Keep the pipeline in workflow order, not alphabetical.
        $order = array_flip(self::PIPELINE_STATUSES);
        usort($byStage, fn ($a, $b) => ($order[$a['status']] ?? 99) <=> ($order[$b['status']] ?? 99));

        $today = now()->startOfDay();

        return [
            'stages' => array_values($byStage),
            'total'  => ['jobs' => $rows->count(), 'value' => round($rows->sum('value'), 2)],
            'jobs'   => $rows->map(fn ($r) => [
                'id'         => $r->id,
                'wo_number'  => $r->wo_number,
                'job_number' => $r->job_number,
                'status'     => $r->status,
                'customer'   => $r->customer,
                'due_date'   => $r->due_date,
                'started'    => $r->started,
                'value'      => round((float) $r->value, 2),
                'overdue'    => $r->due_date !== null && $today->gt($r->due_date),
            ])->all(),
        ];
    }
}
