<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StakeholderFormQuestion extends Model
{
    protected $fillable = [
        'form_id', 'section_id', 'question_text', 'help_text',
        'question_type', 'options', 'settings', 'is_required', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'options'     => 'array',
            'settings'    => 'array',
            'is_required' => 'boolean',
        ];
    }

    public function form(): BelongsTo    { return $this->belongsTo(StakeholderForm::class, 'form_id'); }
    public function section(): BelongsTo { return $this->belongsTo(StakeholderFormSection::class, 'section_id'); }
    public function answers(): HasMany   { return $this->hasMany(StakeholderFormAnswer::class, 'question_id'); }
}
