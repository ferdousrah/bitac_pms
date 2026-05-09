<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    protected $fillable = [
        'code', 'name', 'name_bn', 'type', 'description', 'display_order', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function machines()  { return $this->hasMany(Machine::class); }
    public function operators() { return $this->hasMany(Operator::class); }

    public function scopeActive($query)  { return $query->where('is_active', true); }
    public function scopeShops($query)   { return $query->where('type', 'production_shop'); }
    public function scopeFunctional($query) { return $query->where('type', 'functional'); }
}
