<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingActionItem extends Model
{
    protected $fillable = [
        'meeting_id', 'description', 'assigned_to_user_id', 'assigned_to_name',
        'due_date', 'status', 'priority', 'context',
        'extracted_from_message_id', 'created_by_user_id', 'completed_at',
    ];

    protected $casts = [
        'due_date'     => 'date',
        'completed_at' => 'datetime',
    ];

    public function meeting() { return $this->belongsTo(Meeting::class); }
    public function assignedTo() { return $this->belongsTo(User::class, 'assigned_to_user_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function sourceMessage() { return $this->belongsTo(MeetingMessage::class, 'extracted_from_message_id'); }
}
