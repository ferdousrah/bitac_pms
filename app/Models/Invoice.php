<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'delivery_order_id', 'invoice_number',
        'subtotal', 'discount', 'vat_rate', 'vat_amount', 'total_amount',
        'status', 'issued_date', 'due_date', 'payment_terms',
    ];

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function customer()      { return $this->belongsTo(Customer::class); }
    public function deliveryOrder() { return $this->belongsTo(DeliveryOrder::class); }
}
