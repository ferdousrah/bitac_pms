<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StakeholderFormSection extends Model
{
    protected $fillable = ['form_id', 'title', 'description', 'sort_order'];

    public function form(): BelongsTo      { return $this->belongsTo(StakeholderForm::class, 'form_id'); }
    public function questions(): HasMany   { return $this->hasMany(StakeholderFormQuestion::class, 'section_id')->orderBy('sort_order'); }
}
