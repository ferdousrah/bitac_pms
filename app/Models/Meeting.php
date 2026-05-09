<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Meeting extends Model
{
    use HasFactory, HasCenter;

    protected $fillable = [
        'title', 'topic', 'host_user_id', 'center_id', 'meeting_code', 'status',
        'presentation_state', 'meeting_notes', 'started_at', 'ended_at',
    ];

    protected $casts = [
        'presentation_state' => 'array',
        'meeting_notes'      => 'array',
        'started_at'         => 'datetime',
        'ended_at'           => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Meeting $meeting) {
            if (!$meeting->meeting_code) {
                $meeting->meeting_code = strtoupper(Str::random(4) . '-' . Str::random(4));
            }
        });
    }

    public function host()
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function participants()
    {
        return $this->hasMany(MeetingParticipant::class);
    }

    public function onlineParticipants()
    {
        return $this->hasMany(MeetingParticipant::class)->where('is_online', true);
    }

    public function messages()
    {
        return $this->hasMany(MeetingMessage::class);
    }

    public function actionItems()
    {
        return $this->hasMany(MeetingActionItem::class);
    }

    public function decisions()
    {
        return $this->hasMany(MeetingDecision::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'meeting_participants')
            ->withPivot('role', 'is_online', 'joined_at', 'left_at')
            ->withTimestamps();
    }
}
