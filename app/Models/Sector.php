<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A client sector — Power, BCIC, Defence, textiles, and so on.
 *
 * ⚠️ **National, not per centre** (no `HasCenter`, unlike most master data
 * here). Per-centre rows would give every centre its own "Power" with its own
 * id, and IED's sector-wise reports could then only group by name. One list
 * keeps the figures comparable across BITAC.
 *
 * `applies_to` says which customer types offer it, so the customer form can
 * narrow the dropdown once a type is picked.
 */
class Sector extends Model
{
    public const TYPES = ['government', 'private'];

    protected $fillable = ['name', 'code', 'applies_to', 'description', 'display_order', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }

    /** Sectors offered for a customer type; null/unknown type means all of them. */
    public function scopeForType($q, ?string $type)
    {
        return in_array($type, self::TYPES, true)
            ? $q->whereIn('applies_to', [$type, 'both'])
            : $q;
    }

    public function scopeOrdered($q)
    {
        return $q->orderBy('display_order')->orderBy('name');
    }
}
