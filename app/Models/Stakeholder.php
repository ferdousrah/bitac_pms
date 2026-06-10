<?php

namespace App\Models;

use App\Scopes\CenterScope;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stakeholder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'name', 'email', 'phone',
        'organization', 'designation', 'category', 'is_active', 'notes',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new CenterScope);
    }

    public function invitations(): HasMany { return $this->hasMany(StakeholderFormInvitation::class); }
    public function responses(): HasMany   { return $this->hasMany(StakeholderFormResponse::class); }

    public function scopeActive($q) { return $q->where('is_active', true); }
}
