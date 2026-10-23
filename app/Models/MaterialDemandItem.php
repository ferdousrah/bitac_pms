<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialDemandItem extends Model
{
    protected $fillable = ['material_demand_id', 'material_id', 'description', 'unit', 'quantity', 'remarks'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }

    public function demand()   { return $this->belongsTo(MaterialDemand::class, 'material_demand_id'); }
    public function material() { return $this->belongsTo(Material::class); }
}
