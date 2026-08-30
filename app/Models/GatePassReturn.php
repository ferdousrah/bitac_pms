<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One recorded return against a gate pass item.
 *
 * Returns are partial by nature — a customer may take back three of five
 * samples today and the rest next week — so an item can have several of
 * these, and `gate_pass_items.returned_qty` is their running total.
 */
class GatePassReturn extends Model
{
    protected $fillable = [
        'gate_pass_id', 'gate_pass_item_id', 'quantity', 'returned_on', 'note', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['returned_on' => 'date', 'quantity' => 'decimal:2'];
    }

    public function gatePass()     { return $this->belongsTo(GatePass::class); }
    public function gatePassItem() { return $this->belongsTo(GatePassItem::class); }
    public function recordedBy()   { return $this->belongsTo(User::class, 'recorded_by'); }
}
