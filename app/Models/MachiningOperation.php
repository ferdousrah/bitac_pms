<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachiningOperation extends Model
{
    protected $fillable = [
        'name', 'category', 'default_unit',
        'rate_group_a', 'rate_group_b', 'rate_group_c',
        'section_id', 'notes', 'is_active', 'display_order',
    ];

    protected function casts(): array
    {
        return [
            'rate_group_a' => 'decimal:2',
            'rate_group_b' => 'decimal:2',
            'rate_group_c' => 'decimal:2',
            'is_active'    => 'boolean',
        ];
    }

    public function section() { return $this->belongsTo(Section::class); }

    public function scopeActive($query) { return $query->where('is_active', true); }
    public function scopeCategory($query, string $cat) { return $query->where('category', $cat); }

    public function rateForGroup(string $group): ?float
    {
        return match (strtoupper($group)) {
            'A' => (float) $this->rate_group_a,
            'B' => (float) $this->rate_group_b,
            'C' => (float) $this->rate_group_c,
            default => null,
        };
    }
}
