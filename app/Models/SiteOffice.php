<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One of BITAC's offices on the public Contact page.
 *
 * ⚠️ Not a `Center` — see the migration. It may link to one, and then takes
 * any field it leaves blank from that centre's letterhead.
 */
class SiteOffice extends Model
{
    protected $fillable = [
        'center_id', 'slug', 'name', 'address', 'phone', 'fax', 'email',
        'map_query', 'latitude', 'longitude', 'is_head_office', 'sort', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_head_office' => 'boolean',
            'is_active'      => 'boolean',
            'latitude'       => 'float',
            'longitude'      => 'float',
        ];
    }

    public function center()
    {
        // The centre is read for its letterhead fields only, whichever centre
        // the signed-in user (if any) has active.
        return $this->belongsTo(Center::class)->withoutGlobalScopes();
    }

    public function contacts()
    {
        return $this->hasMany(SiteOfficeContact::class)->orderBy('sort')->orderBy('id');
    }

    public function scopeActive($q) { return $q->where('is_active', true); }

    // ── What the page shows: this office's own value, else the centre's ──

    public function getShownAddressAttribute(): ?string
    {
        return $this->address ?: ($this->center?->address_bn ?: $this->center?->address);
    }

    public function getShownPhoneAttribute(): ?string
    {
        return $this->phone ?: ($this->center?->phone_bn ?: $this->center?->phone);
    }

    public function getShownEmailAttribute(): ?string
    {
        return $this->email ?: $this->center?->email;
    }

    /** What the map looks for, when there is no exact pin. */
    private function mapTarget(): string
    {
        if ($this->latitude !== null && $this->longitude !== null) {
            return $this->latitude . ',' . $this->longitude;
        }

        return $this->map_query ?: trim('BITAC ' . $this->name . ', ' . $this->shown_address, ', ');
    }

    /**
     * The map in the page.
     *
     * ⚠️ The plain `maps.google.com/maps?…&output=embed` form needs no API key,
     * which is what lets an editor change a pin without anyone provisioning
     * credentials. An exact pin (latitude/longitude) wins over the search
     * text, because a search can land on the wrong building.
     */
    public function getMapEmbedUrlAttribute(): string
    {
        return 'https://maps.google.com/maps?' . http_build_query([
            'q' => $this->mapTarget(), 'z' => $this->latitude !== null ? 17 : 15, 'output' => 'embed',
        ]);
    }

    /** "Open in Google Maps" / directions on a phone. */
    public function getMapLinkAttribute(): string
    {
        return 'https://www.google.com/maps/search/?' . http_build_query(['api' => 1, 'query' => $this->mapTarget()]);
    }
}
