<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StakeholderFormResponse extends Model
{
    protected $fillable = [
        'form_id', 'invitation_id', 'customer_id',
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
    public function customer(): BelongsTo     { return $this->belongsTo(Customer::class); }
    public function answers(): HasMany        { return $this->hasMany(StakeholderFormAnswer::class, 'response_id'); }

    /**
     * Who answered, whatever the route in: an invited client, a public
     * submission, or an answer carried over from the old stakeholder directory
     * (whose author was copied into `anonymous_name` when that table went).
     */
    public function getDisplayNameAttribute(): string
    {
        $client = $this->customer ?? $this->invitation?->customer;
        if ($client) return $client->contact_person ?: $client->name;
        if ($this->anonymous_name) return $this->anonymous_name;

        return 'Anonymous';
    }
}
