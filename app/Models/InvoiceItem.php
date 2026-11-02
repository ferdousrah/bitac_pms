<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One line of a bill: what was delivered (or the advance), at the quotation's VAT-inclusive unit price. */
class InvoiceItem extends Model
{
    protected $fillable = ['invoice_id', 'delivery_order_id', 'work_order_item_id', 'description', 'part_no', 'unit',
        'quantity', 'unit_price', 'amount', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'float', 'unit_price' => 'float', 'amount' => 'float'];
    }

    public function invoice()       { return $this->belongsTo(Invoice::class); }
    public function deliveryOrder() { return $this->belongsTo(DeliveryOrder::class); }
}
