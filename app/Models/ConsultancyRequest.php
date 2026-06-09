<?php

namespace App\Models;

use App\Scopes\CenterScope;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultancyRequest extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'request_number',
        'requester_type', 'requester_name', 'requester_email', 'requester_phone',
        'organization_name', 'designation_or_year',
        'subject', 'description', 'preferred_mode', 'attachment_path',
        'status', 'reviewed_by', 'reviewed_at', 'assigned_to',
        'response_notes', 'rejection_reason',
        'completed_at', 'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at'  => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Public submissions also need to skip the center scope so the form
        // can store rows even when no auth context is established.
        static::addGlobalScope(new CenterScope);
    }

    public function reviewer(): BelongsTo    { return $this->belongsTo(\App\Models\User::class, 'reviewed_by'); }
    public function assignedTo(): BelongsTo  { return $this->belongsTo(\App\Models\User::class, 'assigned_to'); }
    public function completedBy(): BelongsTo { return $this->belongsTo(\App\Models\User::class, 'completed_by'); }

    public function scopeYear($q, int $year)
    {
        return $q->whereYear('created_at', $year);
    }

    /**
     * Generate the next request number for the current year.
     * Format: CR-YYYY-NNNN (e.g. CR-2026-0001).
     */
    public static function generateRequestNumber(): string
    {
        $year = now()->year;
        $prefix = "CR-{$year}-";
        $last = static::withoutGlobalScopes()
            ->where('request_number', 'like', "{$prefix}%")
            ->orderByDesc('request_number')
            ->value('request_number');
        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
