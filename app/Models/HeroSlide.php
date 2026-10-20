<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One slide of the public home page's hero.
 *
 * ⚠️ Not a `GalleryItem`: a gallery photo records an event, a hero slide is
 * the front page and carries its own headline and call to action.
 */
class HeroSlide extends Model
{
    public const KINDS = ['image', 'video', 'youtube'];

    /** How long a slide holds when nothing else decides (seconds). */
    public const DEFAULT_HOLD = 8;
    public const YOUTUBE_HOLD = 30;

    protected $fillable = [
        'kind', 'image_path', 'video_path', 'video_url', 'poster_path', 'hold_seconds',
        'title', 'subtitle', 'cta_label', 'cta_url', 'sort', 'is_active', 'created_by',
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

    public function getPosterUrlAttribute(): ?string
    {
        return $this->poster_path ? asset('storage/' . $this->poster_path) : null;
    }

    /** An uploaded file wins over a pasted link — it is the one we can serve. */
    public function getVideoSrcAttribute(): ?string
    {
        if ($this->video_path) {
            return asset('storage/' . $this->video_path);
        }

        return $this->video_url ?: null;
    }

    /**
     * The YouTube id, from whatever shape of link was pasted.
     *
     * ⚠️ A `watch?v=` or `youtu.be/` address renders NOTHING in an iframe —
     * only the `/embed/` form plays — so the link is normalised here rather
     * than expecting whoever pastes it to know that. (`GalleryItem` does the
     * same for the video gallery.)
     */
    public function getYoutubeIdAttribute(): ?string
    {
        $url = trim((string) $this->video_url);
        if ($url === '') return null;

        foreach ([
            '~youtu\.be/([\w-]{6,})~i',
            '~youtube(?:-nocookie)?\.com/.*[?&]v=([\w-]{6,})~i',
            '~youtube(?:-nocookie)?\.com/(?:embed|shorts|live|v)/([\w-]{6,})~i',
        ] as $pattern) {
            if (preg_match($pattern, $url, $m)) return $m[1];
        }

        // Someone may paste the bare id.
        return preg_match('~^[\w-]{11}$~', $url) ? $url : null;
    }

    /**
     * The embed address for a background YouTube slide.
     *
     * ⚠️ Every parameter here is doing a job: `mute=1` because a browser will
     * not autoplay sound; `loop` needs `playlist` set to the same id or it
     * plays once; `controls=0`/`disablekb`/`fs=0` because this is scenery, not
     * a player; `iv_load_policy=3` drops the annotation cards. `nocookie`
     * keeps YouTube from writing a cookie on a government site before anyone
     * has asked to watch anything.
     *
     * ⚠️ **It does not remove YouTube's branding**, and no parameter does —
     * `modestbranding` has been ignored since 2023. The watermark and the
     * title bar are kept out of sight by over-sizing the iframe and cropping
     * it in `HeroSlider`, with a transparent layer over the top so nothing
     * responds to the pointer. A self-hosted .mp4 is still the only way to be
     * certain nothing of theirs appears.
     */
    public function getYoutubeEmbedAttribute(): ?string
    {
        $id = $this->youtube_id;
        if (! $id) return null;

        return 'https://www.youtube-nocookie.com/embed/' . $id . '?' . http_build_query([
            'autoplay' => 1, 'mute' => 1, 'controls' => 0, 'loop' => 1,
            'playlist' => $id, 'playsinline' => 1, 'rel' => 0,
            'iv_load_policy' => 3, 'disablekb' => 1, 'fs' => 0,
            'modestbranding' => 1,
        ]);
    }

    /** Seconds this slide holds before the next one. */
    public function getHoldMsAttribute(): int
    {
        $seconds = (int) ($this->hold_seconds ?: 0);
        if ($seconds > 0) return $seconds * 1000;

        return ($this->kind === 'youtube' ? self::YOUTUBE_HOLD : self::DEFAULT_HOLD) * 1000;
    }

    /**
     * ⚠️ A slide with no media is a black rectangle across the whole front
     * page. Both the public query and the admin's save use this, so one can
     * never show what the other refuses.
     */
    public function hasMedia(): bool
    {
        return match ($this->kind) {
            'video'   => (bool) ($this->video_path || $this->video_url),
            'youtube' => (bool) $this->youtube_id,
            default   => (bool) $this->image_path,
        };
    }
}
