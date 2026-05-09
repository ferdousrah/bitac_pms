<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class OperationSheet extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'sheet_number', 'qr_code', 'notes',
        'approved_by', 'approved_at', 'status',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
        ];
    }

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function steps()     { return $this->hasMany(OperationStep::class)->orderBy('sequence'); }
    public function approvedBy(){ return $this->belongsTo(User::class, 'approved_by'); }
}
