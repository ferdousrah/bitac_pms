<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class EmergencyRequest extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'work_order_item_id', 'customer_id',
        'requester_name', 'requester_contact',
        'reason', 'needed_by', 'requested_priority',
        'status', 'reviewed_by', 'reviewed_at', 'review_notes',
        'original_priority',
    ];

    protected function casts(): array
    {
        return [
            'needed_by'   => 'date',
            'reviewed_at' => 'datetime',
        ];
    }

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function workOrderItem() { return $this->belongsTo(WorkOrderItem::class); }
    public function customer()      { return $this->belongsTo(Customer::class); }
    public function reviewer()      { return $this->belongsTo(User::class, 'reviewed_by'); }

    public function scopePending($q)  { return $q->where('status', 'pending'); }
    public function scopeApproved($q) { return $q->where('status', 'approved'); }
}
