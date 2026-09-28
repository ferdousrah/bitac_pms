<?php

namespace App\Services;

use App\Models\Center;
use App\Models\CenterTarget;
use App\Support\FinancialYear;
use Illuminate\Support\Facades\DB;

/**
 * Target vs Achievement, in taka, per centre, per financial year.
 *
 * **Achievement** = the value of work orders received in the year. A work
 * order carries no money of its own, so the figure comes from the quotation it
 * was issued against (`work_orders.quotation_id` → `quotations.total_amount`).
 * A revised quotation is not a problem: the work order points at the version
 * that was actually accepted, so that is the amount that counts.
 *
 * ⚠️ **Which year a work order falls in is its CUSTOMER's work-order date**
 * (`customer_wo_date`), not when someone keyed it in — a January work order
 * entered in July belongs to January. Rows from before that column existed
 * fall back to `created_at`.
 *
 * ⚠️ Cancelled work orders are excluded. They were never achieved, and IED
 * rejecting one at the inbox sets exactly that status.
 */
class TargetAchievementService
{
    /** Work orders that never happened don't count towards a target. */
    private const EXCLUDED_STATUSES = ['cancelled'];

    /**
     * One row per centre for the given year.
     *
     * @return array<int, array{center_id:int, center:string, target:float, achieved:float, work_orders:int, percent:float, gap:float}>
     */
    public function forYear(string $financialYear, ?int $centerId = null): array
    {
        [$start, $end] = FinancialYear::range($financialYear);

        $centers = Center::query()
            ->when($centerId, fn ($q) => $q->where('id', $centerId))
            ->orderBy('id')->get(['id', 'name']);

        $targets = CenterTarget::where('financial_year', $financialYear)
            ->when($centerId, fn ($q) => $q->where('center_id', $centerId))
            ->pluck('target_amount', 'center_id');

        // COALESCE puts pre-column rows on created_at; the money rides on the
        // linked quotation, so a work order without one contributes nothing.
        $achieved = DB::table('work_orders')
            ->join('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->whereNotIn('work_orders.status', self::EXCLUDED_STATUSES)
            ->whereBetween(
                DB::raw('COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at))'),
                [$start->toDateString(), $end->toDateString()]
            )
            ->when($centerId, fn ($q) => $q->where('work_orders.center_id', $centerId))
            ->groupBy('work_orders.center_id')
            ->select('work_orders.center_id',
                DB::raw('SUM(quotations.total_amount) as amount'),
                DB::raw('COUNT(*) as wo_count'))
            ->get()
            ->keyBy('center_id');

        return $centers->map(function ($c) use ($targets, $achieved) {
            $target = (float) ($targets[$c->id] ?? 0);
            $row    = $achieved[$c->id] ?? null;
            $amount = (float) ($row->amount ?? 0);

            return [
                'center_id'   => $c->id,
                'center'      => $c->name,
                'target'      => round($target, 2),
                'achieved'    => round($amount, 2),
                'work_orders' => (int) ($row->wo_count ?? 0),
                // No target set yet → 0%, rather than dividing by zero.
                'percent'     => $target > 0 ? round($amount / $target * 100, 1) : 0.0,
                'gap'         => round($target - $amount, 2),
            ];
        })->values()->all();
    }

    /**
     * The work orders behind one centre's achievement — so a figure can always
     * be traced back to the documents that make it up.
     */
    public function workOrdersFor(string $financialYear, int $centerId): array
    {
        [$start, $end] = FinancialYear::range($financialYear);

        return DB::table('work_orders')
            ->join('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->leftJoin('customers', 'customers.id', '=', 'work_orders.customer_id')
            ->where('work_orders.center_id', $centerId)
            ->whereNotIn('work_orders.status', self::EXCLUDED_STATUSES)
            ->whereBetween(
                DB::raw('COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at))'),
                [$start->toDateString(), $end->toDateString()]
            )
            ->orderByRaw('COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at)) DESC')
            ->select(
                'work_orders.id',
                'work_orders.wo_number',
                'work_orders.status',
                'work_orders.customer_po_no',
                DB::raw('COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at)) as wo_date'),
                DB::raw('work_orders.customer_wo_date IS NULL as date_is_fallback'),
                'customers.name as customer',
                'quotations.id as quotation_id',
                'quotations.version as quotation_version',
                'quotations.total_amount as amount'
            )
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();
    }
}
