<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BomItem extends Model
{
    protected $fillable = [
        'bom_id', 'material_name', 'material_code',
        'quantity', 'unit', 'wastage_pct',
    ];

    public function bom()
    {
        return $this->belongsTo(Bom::class);
    }
}
