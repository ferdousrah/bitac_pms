<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperationStep extends Model
{
    protected $fillable = [
        'operation_sheet_id', 'sequence', 'operation_name', 'operation_id',
        'section_id', 'machine_id', 'operator_id', 'estimated_hours', 'weight_pct',
        'status', 'actual_hours', 'started_at', 'completed_at', 'tooling_notes', 'qc_notes',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'decimal:2',
            'actual_hours'    => 'decimal:2',
            'weight_pct'      => 'decimal:2',
            'started_at'      => 'datetime',
            'completed_at'    => 'datetime',
        ];
    }

    public function operationSheet()    { return $this->belongsTo(OperationSheet::class); }
    public function section()           { return $this->belongsTo(Section::class); }
    public function machine()           { return $this->belongsTo(Machine::class); }
    public function operator()          { return $this->belongsTo(Operator::class); }
    public function operation()         { return $this->belongsTo(MachiningOperation::class); }
    public function operatorAssignments() { return $this->hasMany(OperatorAssignment::class); }
    public function productionSchedules() { return $this->hasMany(ProductionSchedule::class); }
    public function jobExecutions()       { return $this->hasMany(JobExecution::class); }
    public function qcInspections()       { return $this->hasMany(QcInspection::class); }
}
