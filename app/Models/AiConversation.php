<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiConversation extends Model
{
    protected $fillable = ['user_id', 'title', 'pinned', 'gemini_history', 'last_message_at'];

    protected function casts(): array
    {
        return [
            'gemini_history'  => 'array',
            'pinned'          => 'boolean',
            'last_message_at' => 'datetime',
        ];
    }

    public function user()     { return $this->belongsTo(User::class); }
    public function messages()  { return $this->hasMany(AiMessage::class, 'conversation_id')->orderBy('id'); }

    /** Auto-generate title from the first user message */
    public function generateTitle(): void
    {
        if ($this->title) return;
        $first = $this->messages()->where('role', 'user')->first();
        if ($first) {
            $this->update(['title' => \Illuminate\Support\Str::limit($first->content, 60)]);
        }
    }
}
