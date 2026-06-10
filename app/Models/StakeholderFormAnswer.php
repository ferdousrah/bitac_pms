<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StakeholderFormAnswer extends Model
{
    protected $fillable = ['response_id', 'question_id', 'answer_text', 'answer_options'];

    protected function casts(): array
    {
        return ['answer_options' => 'array'];
    }

    public function response(): BelongsTo { return $this->belongsTo(StakeholderFormResponse::class, 'response_id'); }
    public function question(): BelongsTo { return $this->belongsTo(StakeholderFormQuestion::class, 'question_id'); }
}
