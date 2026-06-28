<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderSection extends Model
{
    protected $fillable = [
        'work_order_id', 'section_id', 'sequence', 'status',
        'started_at', 'completed_at', 'completed_by', 'notes', 'work_hours', 'qc_notes', 'remarks',
    ];

    protected function casts(): array
    {
        return [
            'started_at'   => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function workOrder()   { return $this->belongsTo(WorkOrder::class); }
    public function section()     { return $this->belongsTo(Section::class); }
    public function completedBy() { return $this->belongsTo(User::class, 'completed_by'); }

    public function scopePending($query)    { return $query->where('status', 'pending'); }
    public function scopeReady($query)      { return $query->where('status', 'ready'); }
    public function scopeInProgress($query) { return $query->where('status', 'in_progress'); }
    public function scopeCompleted($query)  { return $query->where('status', 'completed'); }
    public function scopeRework($query)     { return $query->where('status', 'rework'); }

    /** A WOS that the supervisor of $sectionId should see on their queue. */
    public function scopeActiveForSection($query, int $sectionId)
    {
        return $query->where('section_id', $sectionId)
                     ->whereIn('status', ['ready', 'in_progress', 'rework', 'awaiting_rework']);
    }
}
