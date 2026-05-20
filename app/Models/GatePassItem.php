<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GatePassItem extends Model
{
    protected $fillable = [
        'gate_pass_id', 'rfq_item_id', 'description', 'quantity', 'unit',
        'condition_note', 'sort_order',
    ];

    public function gatePass() { return $this->belongsTo(GatePass::class); }
    public function rfqItem()  { return $this->belongsTo(RfqItem::class, 'rfq_item_id'); }
}
