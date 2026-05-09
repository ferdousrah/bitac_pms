<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DowntimeEvent;
use App\Models\Invoice;
use App\Models\JobExecution;
use App\Models\Machine;
use App\Models\Ncr;
use App\Models\Quotation;
use App\Models\WorkCentre;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class LiveDashboardService
{
    public function getData(): array
    {
        return Cache::remember('live_dashboard', 8, fn() => $this->buildData());
    }

    private function buildData(): array
    {
        $today      = Carbon::today();
        $weekStart  = Carbon::now()->startOfWeek();
        $monthStart = Carbon::now()->startOfMonth();

        // ─── Production KPIs ──────────────────────────────────────────
        $activeJobsCount     = WorkOrder::whereIn('status', ['in_production', 'qc_hold'])->count();
        $completedTodayCount = WorkOrder::where('status', 'delivered')
                                        ->whereDate('updated_at', $today)->count();
        $pendingQcCount      = WorkOrder::where('status', 'qc_hold')->count();
        $overdueCount        = WorkOrder::whereNotIn('status', ['delivered', 'cancelled'])
                                        ->whereNotNull('due_date')
                                        ->where('due_date', '<', $today)->count();
        $machinesRunning     = JobExecution::where('status', 'started')
                                           ->whereDate('started_at', $today)
                                           ->distinct('machine_id')->count('machine_id');
        $openNcrs            = Ncr::whereIn('status', ['open', 'in_rework'])->count();

        $kpiCards = [
            ['key' => 'active_jobs',       'value' => $activeJobsCount,     'label' => 'Active Jobs',       'color' => 'blue',   'alert' => false],
            ['key' => 'completed_today',   'value' => $completedTodayCount, 'label' => 'Completed Today',   'color' => 'green',  'alert' => false],
            ['key' => 'pending_qc',        'value' => $pendingQcCount,      'label' => 'Pending QC',        'color' => 'amber',  'alert' => $pendingQcCount > 3],
            ['key' => 'overdue_jobs',      'value' => $overdueCount,        'label' => 'Overdue Jobs',      'color' => 'red',    'alert' => $overdueCount > 0],
            ['key' => 'machines_running',  'value' => $machinesRunning,     'label' => 'Machines Running',  'color' => 'teal',   'alert' => false],
            ['key' => 'open_ncrs',         'value' => $openNcrs,            'label' => 'Open NCRs',         'color' => 'orange', 'alert' => $openNcrs > 2],
        ];

        // ─── Financial Overview ───────────────────────────────────────
        $invoicedToday   = (float) Invoice::whereDate('created_at', $today)->sum('total_amount');
        $invoicedMonth   = (float) Invoice::where('created_at', '>=', $monthStart)->sum('total_amount');
        $outstandingAmt  = (float) Invoice::where('status', 'issued')->sum('total_amount');
        $quotedMonth     = (float) Quotation::where('created_at', '>=', $monthStart)->sum('total_amount');
        $convertedMonth  = (float) Quotation::where('status', 'converted')
                                            ->where('updated_at', '>=', $monthStart)->sum('total_amount');
        $approvedQuotes  = Quotation::where('status', 'approved')->count();
        $pendingQuotes   = Quotation::where('status', 'pending_approval')->count();
        $convRate = $quotedMonth > 0 ? round(($convertedMonth / $quotedMonth) * 100, 1) : 0.0;

        // 7-day revenue trend (today + previous 6 days)
        $revenueTrend = collect(range(6, 0))->map(function ($daysBack) {
            $d = Carbon::today()->subDays($daysBack);
            $sum = (float) Invoice::whereDate('created_at', $d)->sum('total_amount');
            return [
                'date'  => $d->format('M d'),
                'day'   => $d->format('D'),
                'value' => $sum,
            ];
        });

        $maxRevenue = max(1, $revenueTrend->max('value'));

        $financial = [
            'invoiced_today'    => $invoicedToday,
            'invoiced_month'    => $invoicedMonth,
            'outstanding'       => $outstandingAmt,
            'quoted_month'      => $quotedMonth,
            'converted_month'   => $convertedMonth,
            'conversion_rate'   => $convRate,
            'approved_quotes'   => $approvedQuotes,
            'pending_quotes'    => $pendingQuotes,
            'revenue_trend'     => $revenueTrend->map(fn($r) => array_merge($r, [
                'pct' => round(($r['value'] / $maxRevenue) * 100),
            ]))->values(),
        ];

        // ─── Machine Health Overview ──────────────────────────────────
        $machines = Machine::with(['workCentre'])->get();
        $totalMachines = $machines->count();

        $stateBreakdown = [
            'running'     => $machines->where('current_state', 'running')->count(),
            'idle'        => $machines->where('current_state', 'idle')->count(),
            'setup'       => $machines->where('current_state', 'setup')->count(),
            'maintenance' => $machines->where('current_state', 'maintenance')->count(),
            'breakdown'   => $machines->where('current_state', 'breakdown')->count(),
            'offline'     => $machines->where('current_state', 'offline')->count(),
        ];

        $avgHealth = $totalMachines > 0
            ? round($machines->avg(fn($m) => $m->health_score))
            : 0;

        $criticalMachines = $machines
            ->filter(fn($m) => $m->health_score < 40)
            ->sortBy(fn($m) => $m->health_score)
            ->take(5)
            ->map(fn($m) => [
                'id'           => $m->id,
                'name'         => $m->name,
                'code'         => $m->machine_code,
                'work_centre'  => $m->workCentre->name ?? '—',
                'health_score' => $m->health_score,
                'health_label' => $m->health_label,
                'state'        => $m->current_state,
                'state_color'  => $m->state_color,
            ])->values();

        $maintenanceDue = $machines
            ->filter(fn($m) => $m->next_maintenance_date && $m->days_until_maintenance !== null && $m->days_until_maintenance <= 7)
            ->sortBy('days_until_maintenance')
            ->take(5)
            ->map(fn($m) => [
                'id'         => $m->id,
                'name'       => $m->name,
                'code'       => $m->machine_code,
                'days_left'  => (int) $m->days_until_maintenance,
                'overdue'    => $m->days_until_maintenance < 0,
                'next_date'  => $m->next_maintenance_date?->toDateString(),
            ])->values();

        $downtimeTodaySec = (int) DowntimeEvent::whereDate('started_at', $today)
            ->get()
            ->sum(function ($d) {
                $end = $d->ended_at ?? now();
                return $d->started_at->diffInSeconds($end);
            });

        $downtimeWeekSec = (int) DowntimeEvent::where('started_at', '>=', $weekStart)
            ->get()
            ->sum(function ($d) {
                $end = $d->ended_at ?? now();
                return $d->started_at->diffInSeconds($end);
            });

        $machinesData = [
            'total'              => $totalMachines,
            'state_breakdown'    => $stateBreakdown,
            'avg_health'         => $avgHealth,
            'critical_machines'  => $criticalMachines,
            'maintenance_due'    => $maintenanceDue,
            'downtime_today_h'   => round($downtimeTodaySec / 3600, 1),
            'downtime_week_h'    => round($downtimeWeekSec / 3600, 1),
            'utilization_pct'    => $totalMachines > 0
                ? round(($stateBreakdown['running'] / $totalMachines) * 100)
                : 0,
        ];

        // ─── Active Jobs ──────────────────────────────────────────────
        $activeJobs = WorkOrder::with([
            'product', 'customer',
            'jobExecutions' => fn($q) => $q->where('status', 'started')->latest()->limit(1),
            'jobExecutions.operator',
            'jobExecutions.machine.workCentre',
            'operationSheets.steps',
        ])->whereIn('status', ['in_production', 'qc_hold'])
          ->orderByRaw("FIELD(status, 'in_production', 'qc_hold')")
          ->get()
          ->map(function ($wo) {
              $currentExecution = $wo->jobExecutions->first();
              $currentSheet = $wo->operationSheets->first();
              $currentStep = $currentSheet?->steps->first();
              return [
                  'id'               => $wo->id,
                  'wo_number'        => $wo->wo_number,
                  'product'          => $wo->product->name ?? '',
                  'customer'         => $wo->customer->name ?? '',
                  'current_step'     => $currentStep->operation_name ?? '',
                  'work_centre'      => $currentExecution?->machine?->workCentre?->name ?? '',
                  'operator'         => $currentExecution?->operator?->name ?? '',
                  'started_at'       => $currentExecution?->started_at?->toIso8601String(),
                  'estimated_hours'  => $currentStep->estimated_hours ?? 0,
                  'status'           => $wo->status,
                  'status_label'     => $wo->status_label,
                  'due_date'         => $wo->due_date?->toDateString(),
                  'is_overdue'       => $wo->is_overdue,
              ];
          });

        // ─── Work Centres ─────────────────────────────────────────────
        $workCentreStatus = WorkCentre::with([
            'machines',
            'machines.jobExecutions' => fn($q) => $q->where('status', 'started')->with(['workOrder.product', 'operator']),
        ])->where('is_active', true)->get()->map(function ($wc) {
            $totalMachines  = $wc->machines->count();
            $activeMachines = $wc->machines->filter(fn($m) => $m->jobExecutions->isNotEmpty())->count();
            $hasBreakdown   = $wc->machines->where('current_state', 'breakdown')->isNotEmpty();

            $activeJobsList = $wc->machines->flatMap(fn($m) => $m->jobExecutions)
                ->map(fn($je) => [
                    'wo_number' => $je->workOrder->wo_number ?? '',
                    'product'   => $je->workOrder->product->name ?? '',
                    'operator'  => $je->operator->name ?? '',
                ]);

            return [
                'id'              => $wc->id,
                'name'            => $wc->name,
                'total_machines'  => $totalMachines,
                'active_machines' => $activeMachines,
                'active_jobs'     => $activeJobsList->values(),
                'status_color'    => $hasBreakdown ? 'red' : ($activeMachines > 0 ? 'green' : 'gray'),
            ];
        });

        // ─── Recent Alerts ────────────────────────────────────────────
        $recentAlerts = AuditLog::with('user')
            ->whereIn('action', [
                'job_started', 'job_stopped', 'qc_hold', 'qc_passed',
                'ncr_created', 'downtime_logged', 'wo_overdue',
            ])
            ->latest()
            ->limit(15)
            ->get()
            ->map(function ($log) {
                $color = match($log->action) {
                    'job_stopped', 'qc_passed'     => 'green',
                    'ncr_created', 'downtime_logged', 'wo_overdue' => 'red',
                    'qc_hold'                       => 'amber',
                    default                         => 'blue',
                };
                return [
                    'id'        => $log->id,
                    'action'    => $log->action,
                    'message'   => $log->new_values['message'] ?? $log->action,
                    'color'     => $color,
                    'time'      => $log->created_at->format('H:i'),
                    'timestamp' => $log->created_at->toIso8601String(),
                ];
            });

        return [
            'kpi_cards'          => $kpiCards,
            'financial'          => $financial,
            'machines_data'      => $machinesData,
            'active_jobs'        => $activeJobs,
            'work_centre_status' => $workCentreStatus,
            'recent_alerts'      => $recentAlerts,
            'last_updated'       => now()->toIso8601String(),
        ];
    }
}
