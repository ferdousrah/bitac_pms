<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One line of a মূসক ৬.৩ — the eleven columns of the NBR form. */
class MusakChallanItem extends Model
{
    protected $fillable = [
        'musak_challan_id', 'sort_order',
        'description', 'unit', 'quantity', 'unit_price',
        'total_value', 'sd_rate', 'sd_amount', 'vat_rate', 'vat_amount', 'total_inclusive',
    ];

    public function challan() { return $this->belongsTo(MusakChallan::class, 'musak_challan_id'); }
}
