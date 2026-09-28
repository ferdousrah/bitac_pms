<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class StakeholderFormInvitation extends Model
{
    protected $fillable = [
        'form_id', 'customer_id', 'token',
        'sent_at', 'opened_at', 'completed_at',
        'reminder_count', 'last_reminder_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at'          => 'datetime',
            'opened_at'        => 'datetime',
            'completed_at'     => 'datetime',
            'last_reminder_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $i) {
            if (empty($i->token)) $i->token = Str::random(48);
        });
    }

    public function form(): BelongsTo        { return $this->belongsTo(StakeholderForm::class, 'form_id'); }
    /** Stakeholder forms go to CLIENTS — there is no separate directory. */
    public function customer(): BelongsTo    { return $this->belongsTo(Customer::class); }
    public function responses(): HasMany     { return $this->hasMany(StakeholderFormResponse::class, 'invitation_id'); }
}
