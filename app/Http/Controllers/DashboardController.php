<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Models\Ncr;
use App\Models\QcInspection;
use App\Models\WorkOrder;
use App\Services\DashboardMetrics;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user  = auth()->user();
        $today = Carbon::today();

        // ── KPIs, job flow, what is waiting on me — one service for both dashboards.
        $metrics = app(DashboardMetrics::class);
        $kpis    = $metrics->kpis();
        $stages  = $metrics->jobStages();

        // Money only for whoever works with it — a shop engineer's dashboard
        // carries no receivables or quotation figures.
        $seesMoney = $user->can('view payments') || $user->can('view reports') || $user->can('view all centres');
        $money     = $seesMoney ? $metrics->money() : null;

        // ── Recent Work Orders ────────────────────────────────────────
        $recentWorkOrders = WorkOrder::with([
            'product', 'customer', 'operationSheets.steps', 'sections.section',
            'ncrs' => fn($q) => $q->whereIn('status', ['open', 'in_rework']),
        ])
            ->latest()->limit(8)->get()
            ->map(function ($wo) {
                $inRework = $wo->ncrs->isNotEmpty();
                return [
                    'id'           => $wo->id,
                    'wo_number'    => $wo->wo_number,
                    'job_number'   => $wo->job_number,
                    'product'      => $wo->product->name ?? '',
                    'customer'     => $wo->customer->name ?? '',
                    // If the WO has an open NCR, show "In Rework" instead of the
                    // raw status — clearer than "Released to shops" when the job
                    // is actually doing a rework loop.
                    'status'       => $inRework ? 'in_rework' : $wo->status,
                    'status_label' => $inRework ? 'In Rework' : $wo->status_label,
                    'status_color' => $inRework ? 'red' : $wo->status_color,
                    'priority'     => $wo->priority,
                    'due_date'     => $wo->due_date?->format('d/m/Y'),
                    'is_overdue'   => $wo->is_overdue,
                    'progress_pct' => $this->progressFor($wo),
                    'in_rework'    => $inRework,
                ];
            });

        // ── Chart 1: Monthly Production Volume (last 6 months) ───────
        // "delivered" comes from delivery_orders.delivered_at — the real signal,
        // not WO.updated_at.
        $monthlyVolume = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            return [
                'month'     => $month->format('M y'),
                'created'   => WorkOrder::whereYear('created_at', $month->year)
                                        ->whereMonth('created_at', $month->month)->count(),
                'delivered' => DeliveryOrder::whereNotNull('delivered_at')
                                            ->whereYear('delivered_at', $month->year)
                                            ->whereMonth('delivered_at', $month->month)->count(),
            ];
        })->values();

        // ── Chart 2: open jobs by workflow stage (IED → PCD → shops → QC → delivery)
        $pipeline = collect($stages)->whereIn('key', array_keys(DashboardMetrics::STAGES))
            ->where('count', '>', 0)
            ->map(fn ($st) => ['status' => $st['label'], 'key' => $st['key'], 'count' => $st['count'], 'href' => $st['href']])
            ->values();

        // ── Chart 3: QC Pass Rate Trend (last 6 months) ──────────────
        $qcTrend = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            $passed = QcInspection::where('result', 'pass')
                ->whereYear('created_at', $month->year)
                ->whereMonth('created_at', $month->month)->count();
            $failed = QcInspection::where('result', 'fail')
                ->whereYear('created_at', $month->year)
                ->whereMonth('created_at', $month->month)->count();
            $total  = $passed + $failed;
            return [
                'month'     => $month->format('M y'),
                'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 1) : null,
                'passed'    => $passed,
                'failed'    => $failed,
            ];
        })->values();

        // ── Chart 4: On-Time Delivery Rate (last 6 months) ───────────
        // Uses delivery_orders.delivered_at and joins back to work_orders to
        // compare against the WO's due_date — this is the actual on-time signal.
        $deliveryPerf = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            $base = DeliveryOrder::whereNotNull('delivered_at')
                ->whereYear('delivered_at', $month->year)
                ->whereMonth('delivered_at', $month->month)
                ->join('work_orders', 'work_orders.id', '=', 'delivery_orders.work_order_id');
            $total  = (clone $base)->count();
            $onTime = (clone $base)
                ->whereNotNull('work_orders.due_date')
                ->whereColumn('delivery_orders.delivered_at', '<=', 'work_orders.due_date')
                ->count();
            return [
                'month'   => $month->format('M y'),
                'on_time' => $onTime,
                'late'    => $total - $onTime,
                'rate'    => $total > 0 ? round(($onTime / $total) * 100, 1) : null,
            ];
        })->values();

        // ── Chart 5: NCR Trend (last 6 months) ───────────────────────
        $ncrTrend = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            return [
                'month' => $month->format('M y'),
                'ncrs'  => Ncr::whereYear('created_at', $month->year)
                               ->whereMonth('created_at', $month->month)->count(),
            ];
        })->values();

        return Inertia::render('Dashboard/Index', [
            'stats'            => $kpis + ['receivable_due' => $money['net_receivable'] ?? null],
            'stages'           => $stages,
            'waiting'          => $metrics->waitingFor($user),
            'money'            => $money,
            'recentWorkOrders' => $recentWorkOrders,
            'userRole'         => $user->getRoleNames()->first(),
            'charts'           => [
                'monthlyVolume' => $monthlyVolume,
                'pipeline'      => $pipeline,
                'qcTrend'       => $qcTrend,
                'deliveryPerf'  => $deliveryPerf,
                'ncrTrend'      => $ncrTrend,
            ],
        ]);
    }

    /**
     * Section-weighted production progress % — delegates to the WorkOrder model
     * so the dashboard, the WO list and the production views all agree.
     */
    private function progressFor(WorkOrder $wo): ?int
    {
        return $wo->production_progress;
    }
}
