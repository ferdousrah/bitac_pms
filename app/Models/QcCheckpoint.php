<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class QcCheckpoint extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'name', 'category', 'description', 'is_active', 'display_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active'     => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }
}
