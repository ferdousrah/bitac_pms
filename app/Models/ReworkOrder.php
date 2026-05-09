<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class ReworkOrder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'ncr_id', 'original_work_order_id', 'rework_wo_number', 'status', 'notes', 'created_by',
    ];

    public function ncr()               { return $this->belongsTo(Ncr::class); }
    public function originalWorkOrder() { return $this->belongsTo(WorkOrder::class, 'original_work_order_id'); }
    public function createdBy()         { return $this->belongsTo(User::class, 'created_by'); }
}
