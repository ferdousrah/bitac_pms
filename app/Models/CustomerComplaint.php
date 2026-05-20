<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class CustomerComplaint extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'customer_id', 'work_order_id', 'reference_number',
        'subject', 'message', 'category', 'status',
        'response', 'responded_by', 'responded_at',
    ];

    protected function casts(): array
    {
        return ['responded_at' => 'datetime'];
    }

    public function customer()     { return $this->belongsTo(Customer::class); }
    public function workOrder()    { return $this->belongsTo(WorkOrder::class); }
    public function respondedBy()  { return $this->belongsTo(User::class, 'responded_by'); }
}
