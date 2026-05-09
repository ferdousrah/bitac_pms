<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Operator extends Model
{
    protected $fillable = [
        'employee_id', 'name', 'section_id', 'user_id',
        'phone', 'skills', 'shift', 'is_active', 'joined_on',
    ];

    protected function casts(): array
    {
        return [
            'skills'    => 'array',
            'is_active' => 'boolean',
            'joined_on' => 'date',
        ];
    }

    public function section() { return $this->belongsTo(Section::class); }
    public function user()    { return $this->belongsTo(User::class); }

    public function scopeActive($query) { return $query->where('is_active', true); }
    public function scopeInSection($query, int $sectionId) { return $query->where('section_id', $sectionId); }
}
