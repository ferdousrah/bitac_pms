<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** An important link in the footer / links block of the public site. */
class SiteLink extends Model
{
    public const GROUPS = ['important', 'ministry', 'service'];

    protected $fillable = ['label', 'url', 'group', 'sort', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }
}
