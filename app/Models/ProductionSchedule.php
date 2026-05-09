<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class ProductionSchedule extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'operation_step_id', 'machine_id', 'scheduled_date', 'shift', 'status', 'notes'];

    protected function casts(): array { return ['scheduled_date' => 'date']; }

    public function operationStep() { return $this->belongsTo(OperationStep::class); }
    public function machine()       { return $this->belongsTo(Machine::class); }
}
