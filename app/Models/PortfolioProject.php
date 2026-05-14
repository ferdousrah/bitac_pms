<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class PortfolioProject extends Model
{
    protected $fillable = [
        'title', 'slug', 'client_name', 'category', 'summary', 'description',
        'specs', 'cover_image_path', 'completed_at', 'is_published',
        'display_order', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'specs'         => 'array',
            'is_published'  => 'boolean',
            'completed_at'  => 'date',
        ];
    }

    public function photos()
    {
        return $this->hasMany(PortfolioPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Public URL of the cover image (or null if none uploaded).
     */
    public function getCoverImageUrlAttribute(): ?string
    {
        return $this->cover_image_path
            ? Storage::disk('public')->url($this->cover_image_path)
            : null;
    }

    /**
     * Generate a unique URL slug from a title. Appends -N when needed so two
     * projects with the same title don't collide.
     */
    public static function generateUniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title);
        if ($base === '') $base = 'project';
        $slug = $base;
        $i = 1;
        while (static::where('slug', $slug)
            ->when($ignoreId, fn($q) => $q->where('id', '!=', $ignoreId))
            ->exists()
        ) {
            $slug = $base . '-' . (++$i);
        }
        return $slug;
    }
}
