<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A post on the public site: news, an event, a notice or a tender.
 *
 * ⚠️ One `title`/`body`, not an English/Bangla pair — whatever the editor
 * types is what the site shows (BITAC). Bangla is ordinary UTF-8 here.
 */
class NewsPost extends Model
{
    public const KINDS = ['news', 'event', 'notice', 'tender'];

    protected $fillable = [
        'title', 'slug', 'kind', 'excerpt', 'body', 'cover_image_path',
        'event_date', 'location', 'published_at', 'is_published', 'sort', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'event_date'   => 'date',
            'published_at' => 'datetime',
            'is_published' => 'boolean',
        ];
    }

    public function author() { return $this->belongsTo(User::class, 'created_by'); }

    /** Live on the site: published, and its publish moment has arrived. */
    public function scopeLive($q)
    {
        return $q->where('is_published', true)
                 ->where(fn ($w) => $w->whereNull('published_at')->orWhere('published_at', '<=', now()));
    }

    public function getCoverUrlAttribute(): ?string
    {
        return $this->cover_image_path ? asset('storage/' . $this->cover_image_path) : null;
    }

    /**
     * ⚠️ `Str::slug()` strips Bangla entirely — a Bangla-only title would come
     * back as an empty slug, and the second one would collide on the unique
     * index. Fall back to a transliteration-free stub plus the date.
     */
    public static function slugFor(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title) ?: 'post-' . now()->format('Ymd-His');
        $slug = $base;
        $n = 2;
        while (static::where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base . '-' . $n++;
        }

        return $slug;
    }
}
