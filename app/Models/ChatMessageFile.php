<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A file sent in a chat — on the PRIVATE disk, served only to the chat's members. */
class ChatMessageFile extends Model
{
    protected $fillable = ['chat_message_id', 'path', 'original_name', 'mime', 'size'];

    public function message() { return $this->belongsTo(ChatMessage::class, 'chat_message_id'); }

    public function isImage(): bool
    {
        return str_starts_with((string) $this->mime, 'image/');
    }
}
