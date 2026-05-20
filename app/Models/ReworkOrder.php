<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class ReworkOrder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'ncr_id', 'original_work_order_id', 'rework_wo_number', 'status', 'notes', 'created_by',
        'target_section_id', 'target_wos_id',
    ];

    public function ncr()               { return $this->belongsTo(Ncr::class); }
    public function originalWorkOrder() { return $this->belongsTo(WorkOrder::class, 'original_work_order_id'); }
    public function createdBy()         { return $this->belongsTo(User::class, 'created_by'); }
    public function targetSection()     { return $this->belongsTo(Section::class, 'target_section_id'); }
    public function targetWos()         { return $this->belongsTo(WorkOrderSection::class, 'target_wos_id'); }
}
