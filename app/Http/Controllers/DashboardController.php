<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\Ncr;
use App\Models\QcInspection;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user  = auth()->user();
        $today = Carbon::today();

        // ── KPI Stats ────────────────────────────────────────────────
        // Active = anything currently moving through production / QC / pre-delivery.
        // Includes `released_to_shops` because that's the main in-flight state
        // in the new Production module.
        $activeStatuses = ['released_to_shops', 'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery'];

        $stats = [
            'active_work_orders'  => WorkOrder::whereIn('status', $activeStatuses)->count(),
            'overdue_work_orders' => WorkOrder::whereNotIn('status', ['delivered', 'cancelled'])
                                              ->whereNotNull('due_date')
                                              ->where('due_date', '<', $today)->count(),
            'pending_qc'          => WorkOrder::where('status', 'qc_hold')->count(),
            'open_ncrs'           => Ncr::whereIn('status', ['open', 'in_rework'])->count(),
            // "Outstanding" invoices = anything not yet paid. More useful than 'draft'.
            'draft_invoices'      => Invoice::whereIn('status', ['issued', 'acknowledged'])->count(),
            // Delivered today derived from the real delivery signal — POD-stamped
            // delivery_orders, not WO.updated_at (which churns on any edit).
            'delivered_today'     => DeliveryOrder::whereDate('delivered_at', $today)->count(),
        ];

        // ── Recent Work Orders ────────────────────────────────────────
        $recentWorkOrders = WorkOrder::with([
            'product', 'customer', 'operationSheets.steps',
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
                    'status_color' => $inRework ? 'rose' : $wo->status_color,
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

        // ── Chart 2: Work Order Pipeline (current status distribution) ─
        $statusLabels = [
            'draft'              => 'Draft',
            'approved'           => 'Approved',
            'in_production'      => 'In Production',
            'qc_hold'            => 'QC Hold',
            'qc_passed'          => 'QC Passed',
            'ready_for_delivery' => 'Ready',
            'delivered'          => 'Delivered',
            'cancelled'          => 'Cancelled',
        ];
        $pipeline = WorkOrder::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')->get()
            ->map(fn($r) => [
                'status' => $statusLabels[$r->status] ?? $r->status,
                'count'  => $r->count,
            ])->values();

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
            'stats'            => $stats,
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
     * Compute weighted production progress %. Mirrors WorkOrderController so
     * the dashboard and the WO list show the same number.
     */
    private function progressFor(WorkOrder $wo): ?int
    {
        if (in_array($wo->status, ['qc_passed', 'ready_for_delivery', 'delivered'])) return 100;
        if ($wo->status === 'cancelled') return null;

        $sheet = $wo->operationSheets->first();
        if (!$sheet) return 0;
        $steps = $sheet->steps;
        if ($steps->isEmpty()) return 0;

        $weightSum = $steps->sum(fn($s) => (float) $s->weight_pct);
        if ($weightSum > 0) {
            $done = $steps->where('status', 'completed')->sum(fn($s) => (float) $s->weight_pct);
            $wip  = $steps->where('status', 'in_progress')->sum(fn($s) => (float) $s->weight_pct);
            return (int) round(min(100, $done + $wip * 0.5));
        }
        $total = $steps->count();
        $done  = $steps->where('status', 'completed')->count();
        $wip   = $steps->where('status', 'in_progress')->count();
        return (int) round((($done + $wip * 0.5) / $total) * 100);
    }
}
