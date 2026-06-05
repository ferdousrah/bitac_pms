<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialCategory extends Model
{
    protected $fillable = ['code', 'name', 'description', 'display_order', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active'     => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }

    public function materials() { return $this->hasMany(Material::class, 'category', 'code'); }
}
