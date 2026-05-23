<?php

namespace App\Models;

use App\Events\NCRCreated;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Ncr extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'qc_inspection_id', 'work_order_id', 'ncr_number', 'defect_type',
        'affected_qty', 'root_cause', 'corrective_action', 'responsible_user_id', 'status',
    ];

    protected static function boot(): void
    {
        parent::boot();
        static::created(function (Ncr $ncr) {
            if (config('broadcasting.default') !== 'null') {
                broadcast(new NCRCreated($ncr))->toOthers();
            }
        });
    }

    public function qcInspection()    { return $this->belongsTo(QcInspection::class); }
    public function workOrder()       { return $this->belongsTo(WorkOrder::class); }
    public function responsibleUser() { return $this->belongsTo(User::class, 'responsible_user_id'); }
    public function reworkOrders()    { return $this->hasMany(ReworkOrder::class); }
}
