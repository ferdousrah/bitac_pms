<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One of BITAC's service lines, as the public site describes it.
 *
 * ⚠️ Not `job_categories` / `operations` — those are the internal costing and
 * routing vocabulary. This is the public wording, and the two must be free to
 * differ.
 */
class SiteService extends Model
{
    /**
     * The icons a service may wear.
     *
     * ⚠️ A fixed list, keyed by a short name, rather than a free-text Flaticon
     * class: a mistyped class renders NOTHING — no icon, no error, no clue —
     * and whoever is typing the page content should not have to know the
     * library's naming.
     */
    public const ICONS = [
        'settings'   => 'fi-rr-settings',
        'graduation' => 'fi-rr-graduation-cap',
        'shield'     => 'fi-rr-shield-check',
        'bulb'       => 'fi-rr-bulb',
        'industry'   => 'fi-rr-industry-windows',
        'tools'      => 'fi-rr-tools',
        'ruler'      => 'fi-rr-ruler-combined',
        'box'        => 'fi-rr-box',
        'truck'      => 'fi-rr-truck-side',
        'chart'      => 'fi-rr-chart-histogram',
        'document'   => 'fi-rr-file',
        'users'      => 'fi-rr-users',
    ];

    protected $fillable = [
        'title', 'summary', 'body', 'icon', 'image_path', 'sort', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/' . $this->image_path) : null;
    }

    /** The Flaticon class, falling back to a generic one so a card is never blank. */
    public function getIconClassAttribute(): string
    {
        return self::ICONS[$this->icon] ?? 'fi-rr-settings';
    }
}
