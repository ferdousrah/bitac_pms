<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingMessage extends Model
{
    protected $fillable = [
        'meeting_id', 'user_id', 'sender_type', 'content',
        'message_type', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
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
