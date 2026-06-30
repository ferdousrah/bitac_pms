<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderSection extends Model
{
    protected $fillable = [
        'work_order_id', 'section_id', 'sequence', 'weight_pct', 'status',
        'started_at', 'completed_at', 'completed_by', 'notes', 'work_hours', 'qc_notes', 'remarks',
    ];

    protected function casts(): array
    {
        return [
            'started_at'   => 'datetime',
            'completed_at' => 'datetime',
            'weight_pct'   => 'decimal:2',
        ];
    }

    /**
     * Completion fraction (0–1) of this section, by quantity. Averages the
     * progress fraction of every operation step parked at this section across
     * all of the work order's operation sheets. Falls back to the section's own
     * status when it has no operation steps (e.g. a QC-only stop).
     */
    public function progressFraction(): float
    {
        $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
        if (!$wo) return $this->statusFraction();

        $sheets = $wo->relationLoaded('operationSheets') ? $wo->operationSheets : $wo->operationSheets()->with('steps')->get();
        $steps = $sheets->flatMap(fn ($sh) => $sh->relationLoaded('steps') ? $sh->steps : $sh->steps()->get())
            ->where('section_id', $this->section_id);

        if ($steps->isEmpty()) return $this->statusFraction();

        return min(1.0, $steps->avg(fn ($s) => $s->progressFraction()));
    }

    private function statusFraction(): float
    {
        return match ($this->status) {
            'completed'   => 1.0,
            'in_progress' => 0.5,
            default       => 0.0,
        };
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
