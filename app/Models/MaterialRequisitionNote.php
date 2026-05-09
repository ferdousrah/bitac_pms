<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class MaterialRequisitionNote extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'material_name', 'material_code',
        'bom_qty', 'required_qty', 'unit', 'stock_qty', 'lead_time_days', 'status',
    ];

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
}
