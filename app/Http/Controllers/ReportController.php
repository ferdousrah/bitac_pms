<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Models\Machine;
use App\Models\Ncr;
use App\Models\OperationStep;
use App\Models\QcInspection;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * BITAC PMS reports.
 *
 * Notes for future maintainers:
 *  - The legacy `job_executions` table was used by the old Shop Floor terminal.
 *    The new Production module writes status to `operation_steps`, so reports
 *    derive metrics from operation_steps (actual_hours, completed_at, status)
 *    rather than job_executions.
 *  - Frontend pages expect a single `data` prop and a `filters` prop. Keep
 *    payload shape stable when changing this controller.
 */
class ReportController extends Controller
{
    /** Resolve a from/to date window from request, defaulting to current month. */
    private function dateWindow(Request $request): array
    {
        $from = $request->input('from')
            ? Carbon::parse($request->input('from'))->startOfDay()
            : Carbon::now()->startOfMonth();
        $to   = $request->input('to')
            ? Carbon::parse($request->input('to'))->endOfDay()
            : Carbon::now()->endOfMonth();
        return [$from, $to];
    }

    public function production(Request $request)
    {
        [$from, $to] = $this->dateWindow($request);
        $today       = Carbon::today();

        // ── KPI tiles ────────────────────────────────────────────────
        $base = WorkOrder::whereBetween('created_at', [$from, $to]);
        $totalWo      = (clone $base)->count();
        $completed    = (clone $base)->where('status', 'delivered')->count();
        $inProduction = (clone $base)
            ->whereIn('status', ['in_production', 'released_to_shops', 'qc_hold', 'qc_passed', 'ready_for_delivery'])
            ->count();
        $overdue = (clone $base)
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->count();

        // ── Monthly chart ────────────────────────────────────────────
        // Bucket created_at by year-month. Each row shows completed and
        // in-production counts so the chart can stack/compare.
        $rows = WorkOrder::whereBetween('created_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as ym, status, COUNT(*) as c")
            ->groupBy('ym', 'status')
            ->get();

        $byMonth = $rows->groupBy('ym')->map(function ($g, $ym) {
            return [
                'month'         => Carbon::createFromFormat('Y-m', $ym)->format('M y'),
                'completed'     => (int) ($g->firstWhere('status', 'delivered')->c ?? 0),
                'in_production' => (int) $g->whereIn('status', ['in_production', 'released_to_shops', 'qc_hold', 'qc_passed', 'ready_for_delivery'])->sum('c'),
            ];
        })->sortKeys()->values();

        // ── Work order rows ──────────────────────────────────────────
        $workOrders = WorkOrder::whereBetween('created_at', [$from, $to])
            ->with(['product', 'customer', 'deliveryOrders' => fn($q) => $q->orderBy('id', 'desc')])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($wo) {
                $deliveredAt = $wo->deliveryOrders->whereNotNull('delivered_at')->sortByDesc('delivered_at')->first()?->delivered_at;
                $leadDays    = $deliveredAt
                    ? $wo->created_at->diffInDays($deliveredAt)
                    : ($wo->status === 'delivered' ? $wo->created_at->diffInDays($wo->updated_at) : null);

                return [
                    'id'              => $wo->id,
                    'wo_number'       => $wo->wo_number,
                    'job_number'      => $wo->job_number,
                    'product'         => $wo->product->name ?? '—',
                    'customer'        => $wo->customer->name ?? '—',
                    'quantity'        => (float) $wo->quantity,
                    'status'          => $wo->status,
                    'due_date'        => $wo->due_date?->format('d/m/Y'),
                    'is_overdue'      => $wo->is_overdue,
                    'lead_time_days'  => $leadDays,
                ];
            });

        return Inertia::render('Reports/Production', [
            'data' => [
                'total_wo'      => $totalWo,
                'completed'     => $completed,
                'in_production' => $inProduction,
                'overdue'       => $overdue,
                'by_month'      => $byMonth,
                'work_orders'   => $workOrders,
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
        ]);
    }

    public function rejectionRate(Request $request)
    {
        [$from, $to] = $this->dateWindow($request);

        // QC inspections are the source of truth for pass/fail/conditional.
        $inspections = QcInspection::whereBetween('created_at', [$from, $to])
            ->with('workOrder.product')->get();

        $passed      = $inspections->where('result', 'pass')->count();
        $failed      = $inspections->where('result', 'fail')->count();
        $conditional = $inspections->where('result', 'conditional')->count();
        $total       = $inspections->count();

        $passRate      = $total > 0 ? round(($passed * 100) / $total, 2) : 0.0;
        $rejectionRate = $total > 0 ? round(($failed * 100) / $total, 2) : 0.0;
        $openNcrs      = Ncr::whereIn('status', ['open', 'in_rework'])->count();

        // Top defect types (from NCRs in the window)
        $defectRows = Ncr::whereBetween('created_at', [$from, $to])
            ->selectRaw('defect_type, COUNT(*) as c')
            ->whereNotNull('defect_type')
            ->groupBy('defect_type')
            ->orderByDesc('c')
            ->limit(8)
            ->get()
            ->map(fn($r) => [
                'type'  => mb_strimwidth($r->defect_type, 0, 60, '…'),
                'count' => (int) $r->c,
            ])
            ->values();

        // Pass / fail breakdown by product
        $byProduct = $inspections->groupBy(fn($i) => $i->workOrder->product->name ?? '—')
            ->map(function ($group, $product) {
                $total  = $group->count();
                $failed = $group->where('result', 'fail')->count();
                $rate   = $total > 0 ? round(($failed * 100) / $total, 1) : 0.0;
                return [
                    'product' => $product,
                    'total'   => $total,
                    'failed'  => $failed,
                    'rate'    => $rate,
                ];
            })
            ->sortByDesc('rate')
            ->values();

        return Inertia::render('Reports/RejectionRate', [
            'data' => [
                'total_inspections' => $total,
                'total_passed'      => $passed,
                'total_failed'      => $failed,
                'total_conditional' => $conditional,
                'pass_rate'         => $passRate,
                'rejection_rate'    => $rejectionRate,
                'open_ncrs'         => $openNcrs,
                'by_defect_type'    => $defectRows,
                'by_product'        => $byProduct,
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
        ]);
    }

    public function leadTime(Request $request)
    {
        [$from, $to] = $this->dateWindow($request);

        // Use delivery_orders.delivered_at as the real signal of when the
        // customer received the product. WO.updated_at would change on any
        // edit and isn't reliable.
        $rows = DeliveryOrder::whereNotNull('delivered_at')
            ->whereBetween('delivered_at', [$from, $to])
            ->with('workOrder.product', 'workOrder.customer')
            ->get()
            ->map(function ($d) {
                $wo = $d->workOrder;
                if (!$wo) return null;
                $leadDays = $wo->created_at->diffInDays($d->delivered_at);
                return [
                    'wo_number'    => $wo->wo_number,
                    'product'      => $wo->product->name ?? '—',
                    'customer'     => $wo->customer->name ?? '—',
                    'created_at'   => $wo->created_at->toDateString(),
                    'delivered_at' => $d->delivered_at->toDateString(),
                    'lead_days'    => $leadDays,
                    'was_on_time'  => $wo->due_date ? $d->delivered_at <= $wo->due_date : true,
                ];
            })
            ->filter()->values();

        $leadValues   = $rows->pluck('lead_days');
        $avgLeadTime  = $rows->isNotEmpty() ? round($leadValues->avg(), 1) : 0;
        $minLeadTime  = $rows->isNotEmpty() ? $leadValues->min() : 0;
        $maxLeadTime  = $rows->isNotEmpty() ? $leadValues->max() : 0;

        // Breakdown by product
        $byProduct = $rows->groupBy('product')
            ->map(fn($g, $name) => [
                'product'  => $name,
                'count'    => $g->count(),
                'avg_lead' => round($g->avg('lead_days'), 1),
                'on_time'  => $g->where('was_on_time', true)->count(),
            ])
            ->sortByDesc('count')
            ->values();

        return Inertia::render('Reports/LeadTime', [
            'data' => [
                'avg_lead_time' => $avgLeadTime,
                'min_lead_time' => (int) $minLeadTime,
                'max_lead_time' => (int) $maxLeadTime,
                'work_orders'   => $rows,
                'by_product'    => $byProduct,
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
        ]);
    }

    /**
     * OEE = Availability × Performance × Quality
     *
     *   - Performance = sum(estimated_hours of completed steps) ÷ sum(actual_hours of completed steps)
     *     Higher actual than estimated → performance < 100% (machines slower than plan).
     *   - Availability = completed steps ÷ (completed + skipped + rework + abandoned)
     *     Simplified: % of steps that finished cleanly without being sent back.
     *   - Quality = passed QC inspections ÷ total QC inspections
     *
     * Compared to the textbook OEE, this uses the production-system signals
     * we actually capture (not real shift clocks / downtime tracking).
     */
    public function oee(Request $request)
    {
        [$from, $to] = $this->dateWindow($request);

        $steps = OperationStep::with('machine.workCentre')
            ->whereBetween('updated_at', [$from, $to])
            ->whereIn('status', ['completed', 'in_progress'])
            ->get();

        $completed = $steps->where('status', 'completed');

        $sumEst = (float) $completed->sum('estimated_hours');
        $sumAct = (float) $completed->sum('actual_hours');
        $performance = ($sumAct > 0 && $sumEst > 0)
            ? min(100, round(($sumEst / $sumAct) * 100, 1))
            : 0;

        // Availability — completed vs all "should have moved on" steps
        $totalEligible = $steps->count();
        $availability  = $totalEligible > 0
            ? round(($completed->count() / $totalEligible) * 100, 1)
            : 0;

        // Quality — QC inspection pass rate in the window
        $inspections = QcInspection::whereBetween('created_at', [$from, $to])->get();
        $quality = $inspections->count() > 0
            ? round(($inspections->where('result', 'pass')->count() / $inspections->count()) * 100, 1)
            : 100; // no inspections → assume clean

        $oee = round(($availability / 100) * ($performance / 100) * ($quality / 100) * 100, 1);

        // Per-machine breakdown
        $byMachine = $completed->groupBy('machine_id')
            ->filter(fn($g, $k) => $k !== null)
            ->map(function ($g) {
                $machine     = $g->first()->machine;
                $est         = (float) $g->sum('estimated_hours');
                $act         = (float) $g->sum('actual_hours');
                $perf        = ($act > 0 && $est > 0) ? min(100, round(($est / $act) * 100, 1)) : 0;
                return [
                    'machine'        => $machine?->name ?? '—',
                    'work_centre'    => $machine?->workCentre?->name ?? '—',
                    'available_hrs'  => round($est, 1),
                    'productive_hrs' => round($act, 1),
                    'downtime_hrs'   => round(max(0, $act - $est), 1),
                    'availability'   => 100,
                    'performance'    => $perf,
                    'quality'        => 100,
                    'oee'            => $perf,
                ];
            })->values();

        return Inertia::render('Reports/OEE', [
            'data' => [
                'oee'          => $oee,
                'availability' => $availability,
                'performance'  => $performance,
                'quality'      => $quality,
                'by_machine'   => $byMachine,
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
        ]);
    }

    public function export(Request $request, string $type)
    {
        $headers = ['Content-Type' => 'text/csv', 'Content-Disposition' => "attachment; filename={$type}-report.csv"];
        $callback = function() use ($type) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Report Type', $type, 'Generated', now()->format('d/m/Y H:i')]);
            fputcsv($handle, []);
            fputcsv($handle, ['Job #', 'WO Number', 'Product', 'Customer', 'Quantity', 'Status', 'Due Date', 'Created']);

            WorkOrder::with(['product', 'customer'])
                ->orderBy('id', 'desc')
                ->get()
                ->each(function($wo) use ($handle) {
                    fputcsv($handle, [
                        $wo->job_number,
                        $wo->wo_number,
                        $wo->product->name ?? '',
                        $wo->customer->name ?? '',
                        $wo->quantity,
                        $wo->status,
                        $wo->due_date?->format('d/m/Y') ?? '',
                        $wo->created_at?->format('d/m/Y') ?? '',
                    ]);
                });
            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }
}
