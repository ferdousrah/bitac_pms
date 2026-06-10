<?php

namespace App\Models;

use App\Scopes\CenterScope;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class StakeholderForm extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'title', 'description', 'year', 'status',
        'allow_anonymous', 'allow_public_link',
        'opens_at', 'closes_at', 'shareable_token',
        'created_by', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'allow_anonymous'   => 'boolean',
            'allow_public_link' => 'boolean',
            'opens_at'          => 'datetime',
            'closes_at'         => 'datetime',
            'published_at'      => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new CenterScope);
        static::creating(function (self $f) {
            if (empty($f->shareable_token)) {
                $f->shareable_token = Str::random(32);
            }
        });
    }

    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function sections(): HasMany    { return $this->hasMany(StakeholderFormSection::class, 'form_id')->orderBy('sort_order'); }
    public function questions(): HasMany   { return $this->hasMany(StakeholderFormQuestion::class, 'form_id')->orderBy('sort_order'); }
    public function invitations(): HasMany { return $this->hasMany(StakeholderFormInvitation::class, 'form_id'); }
    public function responses(): HasMany   { return $this->hasMany(StakeholderFormResponse::class, 'form_id'); }

    public function isOpen(): bool
    {
        if ($this->status !== 'published') return false;
        $now = now();
        if ($this->opens_at  && $now->lt($this->opens_at))  return false;
        if ($this->closes_at && $now->gt($this->closes_at)) return false;
        return true;
    }
}
