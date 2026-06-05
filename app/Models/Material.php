<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    protected $fillable = [
        'name', 'category', 'unit', 'rate_per_kg', 'density_kg_m3',
        'notes', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'rate_per_kg'    => 'decimal:2',
            'density_kg_m3'  => 'decimal:2',
            'is_active'      => 'boolean',
        ];
    }

    public function scopeActive($query) { return $query->where('is_active', true); }
}
