<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Machine extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'name', 'machine_code', 'work_centre_id', 'section_id',
        'status', 'description', 'rate_group_a', 'rate_group_b', 'rate_group_c', 'rate_group_student', 'rate_group_public',
        // Asset
        'manufacturer', 'model', 'serial_number', 'purchased_on', 'warranty_expires_on',
        'asset_value', 'location',
        // Operational
        'current_state', 'state_changed_at',
        // Maintenance
        'last_maintenance_date', 'next_maintenance_date',
        'maintenance_interval_days', 'maintenance_interval_hours',
        'total_runtime_hours', 'runtime_since_maintenance',
    ];

    protected function casts(): array
    {
        return [
            'rate_group_a'              => 'decimal:2',
            'rate_group_b'              => 'decimal:2',
            'rate_group_c'              => 'decimal:2',
            'rate_group_student'        => 'decimal:2',
            'rate_group_public'         => 'decimal:2',
            'purchased_on'              => 'date',
            'warranty_expires_on'       => 'date',
            'asset_value'               => 'decimal:2',
            'state_changed_at'          => 'datetime',
            'last_maintenance_date'     => 'date',
            'next_maintenance_date'     => 'date',
            'total_runtime_hours'       => 'decimal:2',
            'runtime_since_maintenance' => 'decimal:2',
        ];
    }

    // ── Relationships ────────────────────────────────────────────
    public function workCentre()      { return $this->belongsTo(WorkCentre::class); }
    public function section()         { return $this->belongsTo(Section::class); }
    public function schedules()       { return $this->hasMany(ProductionSchedule::class); }
    public function jobExecutions()   { return $this->hasMany(JobExecution::class); }
    public function maintenanceLogs() { return $this->hasMany(MachineMaintenanceLog::class)->orderByDesc('performed_on'); }
    public function downtimeEvents()  { return $this->hasMany(DowntimeEvent::class); }

    // ── Pricing ──────────────────────────────────────────────────
    public function rateForGroup(string $group): ?float
    {
        return match (strtoupper($group)) {
            'A' => (float) $this->rate_group_a,
            'B' => (float) $this->rate_group_b,
            'C' => (float) $this->rate_group_c,
            default => null,
        };
    }

    // ── Health Score (0-100) ────────────────────────────────────
    public function getHealthScoreAttribute(): int
    {
        $score = 100;

        // State penalties
        $score -= match ($this->current_state) {
            'breakdown'   => 50,
            'offline'     => 100,
            'maintenance' => 20,
            'setup'       => 5,
            default       => 0,
        };

        // Maintenance overdue
        if ($this->next_maintenance_date) {
            $daysOverdue = now()->startOfDay()->diffInDays($this->next_maintenance_date, false);
            if ($daysOverdue < 0) {
                // Overdue (negative diff)
                $score -= min(40, abs($daysOverdue));
            } elseif ($daysOverdue < 7) {
                // Due within a week
                $score -= 10;
            }
        }

        // Recent breakdowns (last 30 days)
        $recentBreakdowns = $this->maintenanceLogs()
            ->where('type', 'breakdown')
            ->where('performed_on', '>=', now()->subDays(30))
            ->count();
        $score -= min(30, $recentBreakdowns * 10);

        // Warranty expired
        if ($this->warranty_expires_on && $this->warranty_expires_on->isPast()) {
            $score -= 5;
        }

        // Age (over 10 years)
        if ($this->purchased_on && $this->purchased_on->diffInYears(now()) > 10) {
            $score -= 5;
        }

        return max(0, min(100, (int) $score));
    }

    public function getHealthLabelAttribute(): string
    {
        $s = $this->health_score;
        return match (true) {
            $s >= 80 => 'Excellent',
            $s >= 60 => 'Good',
            $s >= 40 => 'Fair',
            $s >= 20 => 'Poor',
            default  => 'Critical',
        };
    }

    public function getHealthColorAttribute(): string
    {
        $s = $this->health_score;
        return match (true) {
            $s >= 80 => 'green',
            $s >= 60 => 'blue',
            $s >= 40 => 'amber',
            $s >= 20 => 'orange',
            default  => 'red',
        };
    }

    // ── Maintenance helpers ─────────────────────────────────────
    public function getMaintenanceStatusAttribute(): string
    {
        if (!$this->next_maintenance_date) return 'not_scheduled';
        $days = now()->startOfDay()->diffInDays($this->next_maintenance_date, false);
        if ($days < 0)  return 'overdue';
        if ($days <= 7) return 'due_soon';
        return 'on_schedule';
    }

    public function getDaysUntilMaintenanceAttribute(): ?int
    {
        if (!$this->next_maintenance_date) return null;
        return (int) now()->startOfDay()->diffInDays($this->next_maintenance_date, false);
    }

    // ── State helpers ────────────────────────────────────────────
    public function getStateColorAttribute(): string
    {
        return match ($this->current_state) {
            'running'     => 'green',
            'idle'        => 'blue',
            'setup'       => 'amber',
            'maintenance' => 'purple',
            'breakdown'   => 'red',
            'offline'     => 'slate',
            default       => 'slate',
        };
    }

    public function changeState(string $newState): void
    {
        $this->update([
            'current_state'    => $newState,
            'state_changed_at' => now(),
        ]);
    }
}
