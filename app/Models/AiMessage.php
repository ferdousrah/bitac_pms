<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiMessage extends Model
{
    protected $fillable = ['conversation_id', 'role', 'content', 'tool_calls', 'attachment'];

    protected function casts(): array
    {
        return [
            'tool_calls' => 'array',
            'attachment'  => 'array',
        ];
    }

    public function conversation() { return $this->belongsTo(AiConversation::class, 'conversation_id'); }
}
