<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderSection extends Model
{
    protected $fillable = [
        'work_order_id', 'section_id', 'sequence', 'weight_pct', 'received_qty', 'forwarded_qty', 'status',
        'started_at', 'completed_at', 'completed_by', 'notes', 'work_hours', 'qc_notes', 'remarks',
    ];

    protected function casts(): array
    {
        return [
            'started_at'    => 'datetime',
            'completed_at'  => 'datetime',
            'weight_pct'    => 'decimal:2',
            'received_qty'  => 'decimal:2',
            'forwarded_qty' => 'decimal:2',
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

    /** This WO's operation steps parked at this section (across all sheets). */
    public function sectionSteps(): \Illuminate\Support\Collection
    {
        $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
        if (!$wo) return collect();
        $sheets = $wo->relationLoaded('operationSheets') ? $wo->operationSheets : $wo->operationSheets()->with('steps')->get();
        return $sheets->flatMap(fn ($sh) => $sh->relationLoaded('steps') ? $sh->steps : $sh->steps()->get())
            ->where('section_id', $this->section_id)
            ->values();
    }

    /**
     * Finished output of this section, by quantity — the number of pieces that
     * have cleared EVERY operation here (min completed_qty across the section's
     * steps). Those are the pieces eligible to be transferred downstream.
     */
    public function sectionOutputQty(): float
    {
        $steps = $this->sectionSteps();
        if ($steps->isEmpty()) return 0.0;
        return (float) $steps->min(fn ($s) => (float) $s->completed_qty);
    }

    /** Throughput target of this section (min target across its steps). */
    public function sectionTargetQty(): float
    {
        $steps = $this->sectionSteps();
        if ($steps->isEmpty()) return 0.0;
        return (float) $steps->min(fn ($s) => (float) ($s->target_qty ?? 0));
    }

    /** Pieces done here but not yet transferred downstream. */
    public function forwardableQty(): float
    {
        return max(0.0, $this->sectionOutputQty() - (float) $this->forwarded_qty);
    }

    /** Is this the first section in the WO's routing? (raw material — ungated). */
    public function isFirstInRouting(): bool
    {
        return !static::where('work_order_id', $this->work_order_id)
            ->where('sequence', '<', $this->sequence)
            ->exists();
    }

    /**
     * How much this section is allowed to work on: what it received from
     * upstream. The first section is ungated (has the raw material). A
     * downstream section with no received_qty yet is gated at 0.
     */
    public function effectiveReceivedQty(): ?float
    {
        if ($this->received_qty !== null) return (float) $this->received_qty;
        return $this->isFirstInRouting() ? null : 0.0; // null = unlimited
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
