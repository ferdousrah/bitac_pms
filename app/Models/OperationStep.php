<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperationStep extends Model
{
    protected $fillable = [
        'operation_sheet_id', 'sequence', 'operation_name', 'operation_id',
        'section_id', 'sub_section_id', 'machine_id', 'operator_id', 'estimated_hours', 'weight_pct',
        'target_qty', 'completed_qty',
        'status', 'actual_hours', 'started_at', 'completed_at', 'tooling_notes', 'qc_notes',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'decimal:2',
            'actual_hours'    => 'decimal:2',
            'weight_pct'      => 'decimal:2',
            'target_qty'      => 'decimal:2',
            'completed_qty'   => 'decimal:2',
            'started_at'      => 'datetime',
            'completed_at'    => 'datetime',
        ];
    }

    public function operationSheet()    { return $this->belongsTo(OperationSheet::class); }
    public function section()           { return $this->belongsTo(Section::class); }
    public function subSection()        { return $this->belongsTo(Section::class, 'sub_section_id'); }
    public function machine()           { return $this->belongsTo(Machine::class); }
    public function operator()          { return $this->belongsTo(Operator::class); }
    public function operation()         { return $this->belongsTo(MachiningOperation::class); }
    public function productionLogs()    { return $this->hasMany(ProductionLog::class)->latest('log_date'); }
    public function operatorAssignments() { return $this->hasMany(OperatorAssignment::class); }
    public function productionSchedules() { return $this->hasMany(ProductionSchedule::class); }
    public function jobExecutions()       { return $this->hasMany(JobExecution::class); }
    public function qcInspections()       { return $this->hasMany(QcInspection::class); }

    /** Pieces still to produce on this step. */
    public function getRemainingQtyAttribute(): float
    {
        $target = (float) ($this->target_qty ?? 0);
        return max(0, $target - (float) $this->completed_qty);
    }

    /** 0..1 completion fraction (qty-based; falls back to status when no target). */
    public function progressFraction(): float
    {
        $target = (float) ($this->target_qty ?? 0);
        if ($target > 0) {
            return min(1, (float) $this->completed_qty / $target);
        }
        return $this->status === 'completed' ? 1.0 : ($this->status === 'in_progress' ? 0.5 : 0.0);
    }
}
