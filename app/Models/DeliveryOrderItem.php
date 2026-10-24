<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One job item's quantity on one delivery challan. */
class DeliveryOrderItem extends Model
{
    protected $fillable = ['delivery_order_id', 'work_order_item_id', 'description', 'part_no', 'unit', 'quantity', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'float'];
    }

    public function deliveryOrder() { return $this->belongsTo(DeliveryOrder::class); }
    public function workOrderItem() { return $this->belongsTo(WorkOrderItem::class); }
}
