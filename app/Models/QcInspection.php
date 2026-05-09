<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class QcInspection extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'inspector_id', 'inspection_type',
        'qty_inspected', 'qty_passed', 'qty_failed', 'result', 'notes',
    ];

    public function workOrder()      { return $this->belongsTo(WorkOrder::class); }
    public function inspector()      { return $this->belongsTo(User::class, 'inspector_id'); }
    public function checklistItems() { return $this->hasMany(QcChecklistItem::class); }
    public function ncrs()           { return $this->hasMany(Ncr::class); }
}
