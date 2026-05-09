<?php

namespace App\Http\Controllers;

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
        $stats = [
            'active_work_orders'  => WorkOrder::whereIn('status', ['in_production', 'qc_hold'])->count(),
            'overdue_work_orders' => WorkOrder::whereNotIn('status', ['delivered', 'cancelled'])
                                              ->whereNotNull('due_date')
                                              ->where('due_date', '<', $today)->count(),
            'pending_qc'          => WorkOrder::where('status', 'qc_hold')->count(),
            'open_ncrs'           => Ncr::whereIn('status', ['open', 'in_rework'])->count(),
            'draft_invoices'      => Invoice::where('status', 'draft')->count(),
            'delivered_today'     => WorkOrder::where('status', 'delivered')
                                              ->whereDate('updated_at', $today)->count(),
        ];

        // ── Recent Work Orders ────────────────────────────────────────
        $recentWorkOrders = WorkOrder::with(['product', 'customer'])
            ->latest()->limit(8)->get()
            ->map(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'product'      => $wo->product->name ?? '',
                'customer'     => $wo->customer->name ?? '',
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'priority'     => $wo->priority,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
                'is_overdue'   => $wo->is_overdue,
            ]);

        // ── Chart 1: Monthly Production Volume (last 6 months) ───────
        $monthlyVolume = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            return [
                'month'     => $month->format('M y'),
                'created'   => WorkOrder::whereYear('created_at', $month->year)
                                        ->whereMonth('created_at', $month->month)->count(),
                'delivered' => WorkOrder::where('status', 'delivered')
                                        ->whereYear('updated_at', $month->year)
                                        ->whereMonth('updated_at', $month->month)->count(),
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
        $deliveryPerf = collect(range(5, 0))->map(function ($i) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            $delivered = WorkOrder::where('status', 'delivered')
                ->whereYear('updated_at', $month->year)
                ->whereMonth('updated_at', $month->month);
            $total   = (clone $delivered)->count();
            $onTime  = (clone $delivered)->whereColumn('updated_at', '<=', 'due_date')->count();
            return [
                'month'      => $month->format('M y'),
                'on_time'    => $onTime,
                'late'       => $total - $onTime,
                'rate'       => $total > 0 ? round(($onTime / $total) * 100, 1) : null,
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
}
