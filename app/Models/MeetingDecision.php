<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingDecision extends Model
{
    protected $fillable = [
        'meeting_id', 'description', 'context',
        'decided_by_user_id', 'decided_by_name',
        'extracted_from_message_id',
    ];

    public function meeting() { return $this->belongsTo(Meeting::class); }
    public function decidedBy() { return $this->belongsTo(User::class, 'decided_by_user_id'); }
    public function sourceMessage() { return $this->belongsTo(MeetingMessage::class, 'extracted_from_message_id'); }
}
