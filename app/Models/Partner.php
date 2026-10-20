<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An organisation BITAC works with, shown as a logo on the public site.
 *
 * ⚠️ Not a `Customer`. A client placed an order and is already listed by name;
 * a partner is an institution BITAC works *with*, and usually has no customer
 * record at all.
 */
class Partner extends Model
{
    public const KINDS = [
        'partner'      => 'Partner',
        'collaborator' => 'Collaborator',
    ];

    protected $fillable = [
        'name', 'kind', 'logo_path', 'url', 'note', 'sort', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }

    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo_path ? asset('storage/' . $this->logo_path) : null;
    }

    public function getKindLabelAttribute(): string
    {
        return self::KINDS[$this->kind] ?? 'Partner';
    }

    /** ⚠️ A logo wall row with no logo is a name in an empty box. */
    public function hasLogo(): bool
    {
        return (bool) $this->logo_path;
    }
}
