<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DeliveryOrder;
use App\Models\DowntimeEvent;
use App\Models\Invoice;
use App\Models\Machine;
use App\Models\Ncr;
use App\Models\OperationStep;
use App\Models\Quotation;
use App\Models\WorkCentre;
use App\Models\WorkOrder;
use App\Models\WorkOrderSection;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

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
        // "Active" = anything moving through production / QC / pre-delivery.
        // released_to_shops is the most common in-flight state in the new
        // Production module, so it must be included.
        $activeStatuses = ['released_to_shops', 'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery'];

        $activeJobsCount     = WorkOrder::whereIn('status', $activeStatuses)->count();
        // Delivered today = POD-stamped delivery orders (real signal, not WO.updated_at).
        $completedTodayCount = DeliveryOrder::whereDate('delivered_at', $today)->count();
        $pendingQcCount      = WorkOrder::where('status', 'qc_hold')->count();
        $overdueCount        = WorkOrder::whereNotIn('status', ['delivered', 'cancelled'])
                                        ->whereNotNull('due_date')
                                        ->where('due_date', '<', $today)->count();
        // Machines running = distinct machines with at least one operation_step in_progress.
        $machinesRunning     = OperationStep::where('status', 'in_progress')
                                            ->whereNotNull('machine_id')
                                            ->distinct('machine_id')
                                            ->count('machine_id');
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
        $outstandingAmt  = (float) Invoice::whereIn('status', ['issued', 'acknowledged'])->sum('total_amount');
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
        // Show every WO in an active state. For each, infer the "current step":
        //   - If a section is in_progress or rework → that section's first active op step
        //   - Else if WO is qc_hold → "Awaiting QC inspection"
        //   - Else if WO is qc_passed / ready_for_delivery → "Ready for dispatch"
        // This keeps WOs visible even when they're parked between sections.
        $activeJobsList = WorkOrder::with([
            'product', 'customer',
            'sections.section',
            'operationSheets.steps.machine.workCentre',
            'operationSheets.steps.operator',
            'ncrs' => fn($q) => $q->whereIn('status', ['open', 'in_rework']),
        ])
            ->whereIn('status', $activeStatuses)
            ->orderByRaw("FIELD(status, 'in_production', 'released_to_shops', 'qc_hold', 'qc_passed', 'ready_for_delivery')")
            ->get();

        $activeJobs = $activeJobsList->map(function ($wo) {
            $sections = $wo->sections;
            $activeSection = $sections->firstWhere('status', 'in_progress')
                          ?? $sections->firstWhere('status', 'rework')
                          ?? $sections->firstWhere('status', 'ready');
            $isRework  = $sections->contains('status', 'rework') || $wo->ncrs->isNotEmpty();

            // Pick most relevant op step within the active section
            $step = null;
            if ($activeSection) {
                $steps = $wo->operationSheets->flatMap->steps
                    ->where('section_id', $activeSection->section_id);
                $step = $steps->firstWhere('status', 'in_progress')
                     ?? $steps->firstWhere('status', 'pending')
                     ?? $steps->first();
            }

            // Friendly "current step" label, even when nothing is actively running
            $currentStepLabel = match (true) {
                $step !== null                  => $step->operation_name,
                $activeSection !== null         => $activeSection->section->name ?? '',
                $wo->status === 'qc_hold'       => 'Awaiting QC inspection',
                $wo->status === 'qc_passed'     => 'Ready for dispatch',
                $wo->status === 'ready_for_delivery' => 'Ready for dispatch',
                default                         => '—',
            };

            return [
                'id'              => $wo->id,
                'wo_number'       => $wo->wo_number,
                'job_number'      => $wo->job_number,
                'product'         => $wo->product->name ?? '',
                'customer'        => $wo->customer->name ?? '',
                'current_step'    => $currentStepLabel,
                'work_centre'     => $step?->machine?->workCentre?->name
                                     ?: ($activeSection?->section?->name ?? ''),
                'operator'        => $step?->operator?->name ?? '',
                'started_at'      => $step?->started_at?->toIso8601String()
                                     ?? $activeSection?->started_at?->toIso8601String(),
                'estimated_hours' => (float) ($step?->estimated_hours ?? 0),
                'status'          => $isRework ? 'in_rework' : $wo->status,
                'status_label'    => $isRework ? 'In Rework' : $wo->status_label,
                'due_date'        => $wo->due_date?->toDateString(),
                'is_overdue'      => $wo->is_overdue,
            ];
        })->values();

        // ─── Work Centres ─────────────────────────────────────────────
        // Each WC's active jobs come from in-progress operation_steps whose
        // machine sits in that WC. We pre-aggregate so each WC card shows the
        // jobs currently being worked on its floor.
        $inProgressSteps = OperationStep::with([
            'machine.workCentre',
            'operator',
            'operationSheet.workOrder.product',
        ])->where('status', 'in_progress')->get();

        $stepsByWc = $inProgressSteps->groupBy(fn($s) => $s->machine?->work_centre_id);

        $workCentreStatus = WorkCentre::with('machines')
            ->where('is_active', true)->get()->map(function ($wc) use ($stepsByWc) {
                $totalMachines = $wc->machines->count();
                $hasBreakdown  = $wc->machines->where('current_state', 'breakdown')->isNotEmpty();

                // Machine-state breakdown from machines.current_state — gives a
                // real signal even when no operation_steps are running.
                $stateMix = [
                    'running'     => $wc->machines->where('current_state', 'running')->count(),
                    'setup'       => $wc->machines->where('current_state', 'setup')->count(),
                    'idle'        => $wc->machines->where('current_state', 'idle')->count(),
                    'maintenance' => $wc->machines->where('current_state', 'maintenance')->count(),
                    'breakdown'   => $wc->machines->where('current_state', 'breakdown')->count(),
                    'offline'     => $wc->machines->where('current_state', 'offline')->count(),
                ];

                $wcSteps = $stepsByWc->get($wc->id, collect());
                $activeMachineIds = $wcSteps->pluck('machine_id')->unique()->filter()->values();
                $activeJobs       = $activeMachineIds->count();

                $activeJobsList = $wcSteps->map(fn($s) => [
                    'wo_number'  => $s->operationSheet?->workOrder?->wo_number ?? '',
                    'job_number' => $s->operationSheet?->workOrder?->job_number,
                    'product'    => $s->operationSheet?->workOrder?->product?->name ?? '',
                    'operator'   => $s->operator?->name ?? '',
                ])->values();

                return [
                    'id'              => $wc->id,
                    'name'            => $wc->name,
                    'total_machines'  => $totalMachines,
                    // Frontend "X/Y running" reads from running (machine.current_state),
                    // not from operation_steps — gives a real signal regardless of
                    // whether an op_step happens to be in_progress right now.
                    'active_machines' => $stateMix['running'],
                    'active_jobs_count' => $activeJobs,
                    'state_mix'       => $stateMix,
                    'active_jobs'     => $activeJobsList,
                    'status_color'    => $hasBreakdown ? 'red' : ($stateMix['running'] > 0 ? 'green' : 'gray'),
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
