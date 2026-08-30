<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GatePassItem extends Model
{
    protected $fillable = [
        'gate_pass_id', 'rfq_item_id', 'description', 'quantity', 'returned_qty', 'unit',
        'condition_note', 'sort_order',
    ];

    public function gatePass() { return $this->belongsTo(GatePass::class); }
    public function rfqItem()  { return $this->belongsTo(RfqItem::class, 'rfq_item_id'); }
    public function returns()  { return $this->hasMany(GatePassReturn::class)->latest('returned_on')->latest('id'); }

    /** How much of this item is still out — never negative. */
    public function outstandingQty(): float
    {
        return max(0, round((float) $this->quantity - (float) $this->returned_qty, 2));
    }

    public function isFullyReturned(): bool
    {
        return $this->outstandingQty() <= 0;
    }

    /** Recompute returned_qty from the recorded returns. */
    public function syncReturnedQty(): void
    {
        $this->update(['returned_qty' => round((float) $this->returns()->sum('quantity'), 2)]);
    }
}
