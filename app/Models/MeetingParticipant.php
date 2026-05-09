<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingParticipant extends Model
{
    protected $fillable = [
        'meeting_id', 'user_id', 'role', 'is_online', 'joined_at', 'left_at',
    ];

    protected $casts = [
        'is_online' => 'boolean',
        'joined_at' => 'datetime',
        'left_at'   => 'datetime',
    ];

    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
