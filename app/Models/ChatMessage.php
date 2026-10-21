<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One message in a section chat (or the common chat, `section_id` NULL).
 * See App\Services\SectionChat for who may read and write where.
 */
class ChatMessage extends Model
{
    protected $fillable = [
        'center_id', 'section_id', 'user_id', 'body', 'is_instruction',
        'reply_to_id', 'deleted_at', 'deleted_by',
    ];

    protected $casts = [
        'is_instruction' => 'boolean',
        'deleted_at'     => 'datetime',
    ];

    public function user()    { return $this->belongsTo(User::class); }
    public function section() { return $this->belongsTo(Section::class); }
    public function replyTo() { return $this->belongsTo(self::class, 'reply_to_id'); }
    public function files()   { return $this->hasMany(ChatMessageFile::class)->orderBy('id'); }

    /** 'common' or the section id — the key a chat is addressed by. */
    public function getChannelAttribute(): string
    {
        return $this->section_id ? (string) $this->section_id : 'common';
    }
}
