<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A photo or a video on the public site.
 *
 * ⚠️ One table for both — they differ only in where the media lives
 * (`image_path` vs `video_url`); everything else is the same, and two tables
 * would be the same admin screen written twice.
 */
class GalleryItem extends Model
{
    public const KINDS = ['photo', 'video'];

    protected $fillable = [
        'kind', 'title', 'caption', 'album', 'image_path', 'video_url',
        'taken_on', 'sort', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return ['taken_on' => 'date', 'is_active' => 'boolean'];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }
    public function scopePhotos($q) { return $q->where('kind', 'photo'); }
    public function scopeVideos($q) { return $q->where('kind', 'video'); }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? asset('storage/' . $this->image_path) : null;
    }

    /**
     * A watchable embed URL.
     *
     * ⚠️ A YouTube "watch?v=" or "youtu.be/" link renders NOTHING in an
     * <iframe> — the site would show an empty black box for every video. Only
     * the /embed/ form works, so normalise here rather than asking whoever
     * pastes a link to know that.
     */
    public function getEmbedUrlAttribute(): ?string
    {
        $url = trim((string) $this->video_url);
        if ($url === '') return null;

        if (preg_match('~youtu\.be/([\w-]{6,})~i', $url, $m)
            || preg_match('~youtube\.com/.*[?&]v=([\w-]{6,})~i', $url, $m)
            || preg_match('~youtube\.com/(?:embed|shorts)/([\w-]{6,})~i', $url, $m)) {
            return 'https://www.youtube.com/embed/' . $m[1];
        }
        if (preg_match('~vimeo\.com/(?:video/)?(\d+)~i', $url, $m)) {
            return 'https://player.vimeo.com/video/' . $m[1];
        }

        return $url;   // already an embed, or some other provider
    }

    /** The still to show before the video is played. */
    public function getThumbUrlAttribute(): ?string
    {
        if ($this->image_url) return $this->image_url;
        if (preg_match('~/embed/([\w-]{6,})~', (string) $this->embed_url, $m)) {
            return "https://img.youtube.com/vi/{$m[1]}/hqdefault.jpg";
        }

        return null;
    }
}
