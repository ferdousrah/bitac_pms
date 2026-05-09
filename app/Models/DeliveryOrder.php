<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class DeliveryOrder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'challan_number', 'quantity_delivered',
        'scheduled_date', 'delivery_address', 'vehicle_number', 'driver_name', 'notes',
        'status', 'delivered_at',
    ];

    protected function casts(): array
    {
        return ['scheduled_date' => 'date', 'delivered_at' => 'datetime'];
    }

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function pod()       { return $this->hasOne(ProofOfDelivery::class, 'delivery_order_id'); }
}
