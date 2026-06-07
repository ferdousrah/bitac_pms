<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GatePassConditionNote extends Model
{
    protected $fillable = ['label', 'display_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
