<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A contact person at one of BITAC's offices.
 *
 * ⚠️ The name is optional: a government office publishes many contacts by
 * post alone, with the post's own email — the person in it changes, the
 * address does not.
 */
class SiteOfficeContact extends Model
{
    protected $fillable = [
        'site_office_id', 'name', 'designation', 'phone', 'mobile', 'email', 'sort', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function office()
    {
        return $this->belongsTo(SiteOffice::class, 'site_office_id');
    }

    public function scopeActive($q) { return $q->where('is_active', true); }
}
