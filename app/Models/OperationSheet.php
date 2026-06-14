<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class OperationSheet extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'work_order_item_id', 'sheet_number',
        'job_title', 'job_description', 'material',
        'qr_code', 'notes',
        'created_by', 'approved_by', 'approved_at', 'status',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
        ];
    }

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function workOrderItem() { return $this->belongsTo(WorkOrderItem::class); }
    public function steps()         { return $this->hasMany(OperationStep::class)->orderBy('sequence'); }
    public function createdBy()     { return $this->belongsTo(User::class, 'created_by'); }
    public function approvedBy()    { return $this->belongsTo(User::class, 'approved_by'); }
    public function messages()      { return $this->hasMany(ProductionMessage::class)->orderBy('created_at'); }
    public function qcInspections() { return $this->hasMany(QcInspection::class)->orderBy('inspected_at'); }
}
