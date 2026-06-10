<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StakeholderFormResponse extends Model
{
    protected $fillable = [
        'form_id', 'invitation_id', 'stakeholder_id',
        'anonymous_name', 'anonymous_organization',
        'ip_address', 'is_complete', 'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'is_complete'  => 'boolean',
            'submitted_at' => 'datetime',
        ];
    }

    public function form(): BelongsTo         { return $this->belongsTo(StakeholderForm::class, 'form_id'); }
    public function invitation(): BelongsTo   { return $this->belongsTo(StakeholderFormInvitation::class, 'invitation_id'); }
    public function stakeholder(): BelongsTo  { return $this->belongsTo(Stakeholder::class); }
    public function answers(): HasMany        { return $this->hasMany(StakeholderFormAnswer::class, 'response_id'); }

    /** Display name regardless of source (stakeholder / anonymous / invitation). */
    public function getDisplayNameAttribute(): string
    {
        if ($this->stakeholder) return $this->stakeholder->name;
        if ($this->invitation?->stakeholder) return $this->invitation->stakeholder->name;
        if ($this->anonymous_name) return $this->anonymous_name;
        return 'Anonymous';
    }
}
