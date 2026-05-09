<?php

namespace App\Services;

use App\Models\Machine;
use App\Models\MachineMaintenanceLog;
use Illuminate\Support\Carbon;

class MachineHealthService
{
    /**
     * Calculate fleet-wide health summary.
     */
    public static function fleetSummary(): array
    {
        $machines = Machine::all();

        return [
            'total'       => $machines->count(),
            'running'     => $machines->where('current_state', 'running')->count(),
            'idle'        => $machines->where('current_state', 'idle')->count(),
            'maintenance' => $machines->where('current_state', 'maintenance')->count(),
            'breakdown'   => $machines->where('current_state', 'breakdown')->count(),
            'offline'     => $machines->where('current_state', 'offline')->count(),
            'overdue'     => $machines->filter(fn($m) => $m->maintenance_status === 'overdue')->count(),
            'due_soon'    => $machines->filter(fn($m) => $m->maintenance_status === 'due_soon')->count(),
            'avg_health'  => round((float) $machines->avg(fn($m) => $m->health_score), 1),
        ];
    }

    /**
     * Get machines that need attention (sorted by urgency).
     */
    public static function needsAttention(int $limit = 10)
    {
        return Machine::with('section')
            ->get()
            ->filter(fn($m) => $m->health_score < 60 || in_array($m->maintenance_status, ['overdue', 'due_soon']))
            ->sortBy(fn($m) => $m->health_score)
            ->take($limit)
            ->values();
    }

    /**
     * Calculate MTBF (Mean Time Between Failures) in days for a machine.
     */
    public static function mtbf(Machine $machine, int $sinceDays = 365): ?float
    {
        $breakdowns = $machine->maintenanceLogs()
            ->where('type', 'breakdown')
            ->where('performed_on', '>=', now()->subDays($sinceDays))
            ->orderBy('performed_on')
            ->get();

        if ($breakdowns->count() < 2) return null;

        $first = $breakdowns->first()->performed_on;
        $last  = $breakdowns->last()->performed_on;
        $totalDays = (float) $first->diffInDays($last);

        return round($totalDays / max(1, $breakdowns->count() - 1), 1);
    }

    /**
     * Calculate MTTR (Mean Time To Repair) in hours.
     */
    public static function mttr(Machine $machine, int $sinceDays = 365): ?float
    {
        $logs = $machine->maintenanceLogs()
            ->whereIn('type', ['breakdown', 'corrective'])
            ->where('performed_on', '>=', now()->subDays($sinceDays))
            ->whereNotNull('downtime_hours')
            ->get();

        if ($logs->isEmpty()) return null;
        return round((float) $logs->avg('downtime_hours'), 1);
    }

    /**
     * Record a maintenance event and update the machine's tracking fields.
     */
    public static function recordMaintenance(Machine $machine, array $data): MachineMaintenanceLog
    {
        $log = $machine->maintenanceLogs()->create($data);

        // Update machine's last/next maintenance dates
        $updates = [
            'last_maintenance_date'     => $log->performed_on,
            'runtime_since_maintenance' => 0,
        ];

        if ($log->next_due_date) {
            $updates['next_maintenance_date'] = $log->next_due_date;
        } elseif ($machine->maintenance_interval_days) {
            $updates['next_maintenance_date'] = $log->performed_on->copy()->addDays($machine->maintenance_interval_days);
        }

        // If machine was in breakdown/maintenance, return to idle after service
        if (in_array($machine->current_state, ['breakdown', 'maintenance'])) {
            $updates['current_state']    = 'idle';
            $updates['state_changed_at'] = now();
        }

        $machine->update($updates);

        return $log;
    }

    /**
     * Total downtime hours in a date range.
     */
    public static function totalDowntime(Machine $machine, int $sinceDays = 30): float
    {
        return (float) $machine->maintenanceLogs()
            ->where('performed_on', '>=', now()->subDays($sinceDays))
            ->sum('downtime_hours');
    }
}
