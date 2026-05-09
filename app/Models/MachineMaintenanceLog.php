<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineMaintenanceLog extends Model
{
    protected $fillable = [
        'machine_id', 'type', 'performed_on', 'performed_by', 'technician_name',
        'description', 'parts_replaced', 'cost', 'downtime_hours', 'next_due_date', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'performed_on'   => 'date',
            'next_due_date'  => 'date',
            'parts_replaced' => 'array',
            'cost'           => 'decimal:2',
            'downtime_hours' => 'decimal:2',
        ];
    }

    public function machine()      { return $this->belongsTo(Machine::class); }
    public function performedBy()  { return $this->belongsTo(User::class, 'performed_by'); }
}
