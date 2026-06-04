<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class MaintenanceRequest extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'machine_id', 'section_id', 'requested_by',
        'reported_problem', 'urgency', 'expected_downtime_hours', 'attachment_paths',
        'status',
        'reviewed_by', 'reviewed_at', 'review_notes',
        'started_at', 'started_by',
        'completed_at', 'completed_by',
        'cancelled_at', 'cancelled_by', 'cancellation_reason',
        'maintenance_log_id', 'machine_state_before',
    ];

    protected function casts(): array
    {
        return [
            'attachment_paths'        => 'array',
            'expected_downtime_hours' => 'decimal:2',
            'reviewed_at'             => 'datetime',
            'started_at'              => 'datetime',
            'completed_at'            => 'datetime',
            'cancelled_at'            => 'datetime',
        ];
    }

    // ── Relations ───────────────────────────────────────────────
    public function machine()        { return $this->belongsTo(Machine::class); }
    public function section()        { return $this->belongsTo(Section::class); }
    public function requester()      { return $this->belongsTo(User::class, 'requested_by'); }
    public function reviewer()       { return $this->belongsTo(User::class, 'reviewed_by'); }
    public function starter()        { return $this->belongsTo(User::class, 'started_by'); }
    public function completer()      { return $this->belongsTo(User::class, 'completed_by'); }
    public function canceller()      { return $this->belongsTo(User::class, 'cancelled_by'); }
    public function maintenanceLog() { return $this->belongsTo(MachineMaintenanceLog::class, 'maintenance_log_id'); }

    // ── Scopes ──────────────────────────────────────────────────
    public function scopePending($q)    { return $q->where('status', 'pending'); }
    public function scopeApproved($q)   { return $q->where('status', 'approved'); }
    public function scopeInProgress($q) { return $q->where('status', 'in_progress'); }
    public function scopeOpen($q)       { return $q->whereIn('status', ['pending', 'approved', 'in_progress']); }

    // ── UI helpers ──────────────────────────────────────────────
    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            'pending'     => 'Pending Approval',
            'approved'    => 'Approved — Ready to Start',
            'rejected'    => 'Rejected',
            'in_progress' => 'In Progress',
            'completed'   => 'Completed',
            'cancelled'   => 'Cancelled',
            default       => ucfirst($this->status),
        };
    }

    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            'pending'     => 'amber',
            'approved'    => 'blue',
            'rejected'    => 'rose',
            'in_progress' => 'purple',
            'completed'   => 'emerald',
            'cancelled'   => 'slate',
            default       => 'slate',
        };
    }

    public function getUrgencyColorAttribute(): string
    {
        return match ($this->urgency) {
            'urgent' => 'rose',
            'normal' => 'amber',
            'low'    => 'slate',
            default  => 'slate',
        };
    }

    /** Public URLs for attached photos (for Inertia payloads). */
    public function attachmentUrls(): array
    {
        return collect($this->attachment_paths ?? [])
            ->map(fn ($p) => \Storage::disk('public')->url($p))
            ->values()->all();
    }
}
