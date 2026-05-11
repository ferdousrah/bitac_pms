<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Center extends Model
{
    protected $fillable = [
        'name', 'code', 'address', 'phone', 'email', 'is_active',
        // Letterhead fields (per-center PDF header/footer config)
        'name_bn', 'caption_en', 'ministry_bn', 'government_bn',
        'address_bn', 'phone_bn', 'fax_bn', 'website',
        'logo_left_path', 'logo_right_path', 'letterhead_color',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $appends = ['logo_left_url', 'logo_right_url'];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    /** Resolve the disk URL for the left (BITAC) logo, or null. */
    public function getLogoLeftUrlAttribute(): ?string
    {
        return $this->logo_left_path ? Storage::disk('public')->url($this->logo_left_path) : null;
    }

    /** Resolve the disk URL for the right (Government seal) logo, or null. */
    public function getLogoRightUrlAttribute(): ?string
    {
        return $this->logo_right_path ? Storage::disk('public')->url($this->logo_right_path) : null;
    }

    /** Absolute filesystem path for the left logo (for embedding in PDFs). */
    public function logoLeftAbsolutePath(): ?string
    {
        return $this->logo_left_path ? Storage::disk('public')->path($this->logo_left_path) : null;
    }

    /** Absolute filesystem path for the right logo (for embedding in PDFs). */
    public function logoRightAbsolutePath(): ?string
    {
        return $this->logo_right_path ? Storage::disk('public')->path($this->logo_right_path) : null;
    }
}
