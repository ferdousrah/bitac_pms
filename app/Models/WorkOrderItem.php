<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderItem extends Model
{
    protected $fillable = [
        'work_order_id', 'job_number', 'product_id', 'rfq_item_id', 'quotation_item_id',
        'description', 'quantity', 'unit', 'status', 'display_order', 'notes', 'ied_note', 'pcd_note',
    ];

    protected function casts(): array
    {
        return [
            'quantity'      => 'decimal:2',
            'display_order' => 'integer',
        ];
    }

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function product()       { return $this->belongsTo(Product::class); }
    public function rfqItem()       { return $this->belongsTo(RfqItem::class); }
    public function quotationItem() { return $this->belongsTo(QuotationItem::class); }
    public function operationSheet(){ return $this->hasOne(OperationSheet::class, 'work_order_item_id'); }

    public function getDisplayLabelAttribute(): string
    {
        return $this->product?->name ?: ($this->description ?: 'Item #' . $this->id);
    }

    public function getJobNumberFormattedAttribute(): string
    {
        return $this->job_number ? str_pad((string) $this->job_number, 5, '0', STR_PAD_LEFT) : '—';
    }
}
