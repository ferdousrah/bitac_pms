<?php

namespace App\Services;

use App\Models\Machine;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class LiveDashboardService
{
    public function getData(): array
    {
        // ⚠️ One copy PER CENTRE (and one for "all centres"). With a single
        // key, whichever centre asked first filled the 8-second cache and the
        // next centre was shown its figures.
        $centre = app()->bound('current_center_id') ? app('current_center_id') : null;

        // …and per whether the viewer may see the money, or the first person to
        // fill the cache decides what everyone after them is shown.
        $money = self::seesMoney();

        return Cache::remember('live_dashboard' . ($centre ? ".{$centre}" : '.all') . ($money ? '' : '.nomoney'), 8,
            fn() => $this->buildData($money));
    }

    public static function seesMoney(): bool
    {
        $u = auth()->user();
        return $u && ($u->can('view payments') || $u->can('view reports') || $u->can('view all centres'));
    }

    private function buildData(bool $withMoney): array
    {
        $metrics = app(DashboardMetrics::class);
        // ─── Production KPIs — the same figures as /dashboard (DashboardMetrics).
        $k = $metrics->kpis();
        // The list below: jobs from the shop floor to the last delivery.
        $activeStatuses = array_merge(DashboardMetrics::STAGES['shops']['statuses'],
            DashboardMetrics::STAGES['qc']['statuses'], DashboardMetrics::STAGES['delivery']['statuses']);

        $kpiCards = [
            ['key' => 'active_jobs',      'value' => $k['active_jobs'],      'label' => 'Jobs in Hand',     'color' => 'blue',   'alert' => false],
            ['key' => 'completed_today',  'value' => $k['delivered_today'],  'label' => 'Delivered Today',  'color' => 'green',  'alert' => false],
            ['key' => 'pending_qc',       'value' => $k['at_qc'],            'label' => 'At Inspection',    'color' => 'amber',  'alert' => $k['at_qc'] > 3],
            ['key' => 'overdue_jobs',     'value' => $k['overdue'],          'label' => 'Overdue Jobs',     'color' => 'red',    'alert' => $k['overdue'] > 0],
            ['key' => 'machines_running', 'value' => $k['machines_running'], 'label' => 'Machines Running', 'color' => 'teal',   'alert' => false],
            ['key' => 'open_ncrs',        'value' => $k['open_ncrs'],        'label' => 'Open NCRs',        'color' => 'orange', 'alert' => $k['open_ncrs'] > 2],
        ];

        // ─── Financial Overview — read from the reports, never re-derived.
        $financial = null;
        if ($withMoney) {
            $trend = collect($metrics->billingTrend());
            $max   = max(1, $trend->max('value'));
            $financial = $metrics->money() + [
                'revenue_trend' => $trend->map(fn ($r) => $r + ['pct' => round($r['value'] / $max * 100)])->values(),
            ];
        }

        // ─── Machine Health Overview ──────────────────────────────────
        $machines = DashboardMetrics::machines()->with(['section'])->get();
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
                'work_centre'  => $m->section->name ?? '—',
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

        $machinesData = [
            'total'              => $totalMachines,
            'state_breakdown'    => $stateBreakdown,
            'avg_health'         => $avgHealth,
            'critical_machines'  => $criticalMachines,
            'maintenance_due'    => $maintenanceDue,
            // Open maintenance requests replaced the old downtime log, which
            // nothing has written since the shop-floor module was retired.
            'maintenance'        => $metrics->maintenance(),
            'utilization_pct'    => $totalMachines > 0
                ? round(($stateBreakdown['running'] / $totalMachines) * 100)
                : 0,
        ];

        // ─── Active Jobs ──────────────────────────────────────────────
        // Show every WO in an active state. For each, infer the "current step":
        //   - If a section is in_progress or rework → that section's first active op step
        //   - Else if WO is qc_hold → "Awaiting inspection"
        //   - Else if WO is qc_passed / ready_for_delivery → "Ready for dispatch"
        // This keeps WOs visible even when they're parked between sections.
        $activeJobsList = WorkOrder::with([
            'product', 'customer', 'items',
            'sections.section',
            'operationSheets.steps.machine.workCentre',
            'operationSheets.steps.operator',
            'ncrs' => fn($q) => $q->whereIn('status', ['open', 'in_rework']),
        ])
            ->whereIn('status', $activeStatuses)
            ->orderByRaw("FIELD(status, 'in_production', 'released_to_shops', 'qc_hold', 'qc_passed', 'ready_for_delivery', 'partially_delivered')")
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
                $wo->status === 'qc_hold'       => 'Awaiting inspection',
                $wo->status === 'qc_passed'     => 'Ready for dispatch',
                $wo->status === 'ready_for_delivery' => 'Ready for dispatch',
                $wo->status === 'partially_delivered' => 'Part delivered — rest to follow',
                default                         => '—',
            };

            return [
                'id'              => $wo->id,
                'wo_number'       => $wo->wo_number,
                'job_number'      => $wo->job_number,
                'product'         => $wo->product->name ?? ((string) $wo->items->first()?->description),
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

        // ─── Shops (the old work_centres table no longer describes the floor)
        $workCentreStatus = $metrics->shops();

        // ─── Recent activity, from the audit trail
        $recentAlerts = $metrics->activity();

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
