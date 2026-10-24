<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class DeliveryOrder extends Model
{
    use HasCenter;

    /** A delivery in any of these has goods committed to it (not free to send again). */
    public const COMMITTED = ['scheduled', 'dispatched', 'delivered'];

    /** Full = every item of the job at once; partial = anything less (Partial Challan). */
    public const TYPES = ['full' => 'Full delivery', 'partial' => 'Partial delivery'];

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'challan_number', 'quantity_delivered', 'delivery_type',
        'scheduled_date', 'delivery_address', 'vehicle_number', 'driver_name', 'notes',
        'status', 'delivered_at',
    ];

    protected function casts(): array
    {
        return ['scheduled_date' => 'date', 'delivered_at' => 'datetime', 'quantity_delivered' => 'float'];
    }

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function pod()       { return $this->hasOne(ProofOfDelivery::class, 'delivery_order_id'); }
    public function invoice()   { return $this->hasOne(Invoice::class, 'delivery_order_id'); }
    public function items()     { return $this->hasMany(DeliveryOrderItem::class)->orderBy('sort_order'); }

    /**
     * full | partial. Recorded on deliveries made since 2026-10-24; older ones
     * are worked out from their quantity against the order.
     */
    public function getTypeAttribute(): string
    {
        if ($this->delivery_type) {
            return $this->delivery_type;
        }
        $ordered = (float) ($this->workOrder?->quantity ?? 0);

        return $ordered > 0 && (float) $this->quantity_delivered >= $ordered - 0.001 ? 'full' : 'partial';
    }

    public function getTypeLabelAttribute(): string
    {
        return self::TYPES[$this->type];
    }
}
