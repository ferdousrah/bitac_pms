<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SectionHandoff extends Model
{
    protected $fillable = [
        'work_order_id', 'from_section_id', 'to_section_id', 'direction',
        'note', 'rework_for_id', 'transferred_by', 'transferred_at',
    ];

    protected function casts(): array
    {
        return [
            'transferred_at' => 'datetime',
        ];
    }

    public function workOrder()    { return $this->belongsTo(WorkOrder::class); }
    public function fromSection()  { return $this->belongsTo(Section::class, 'from_section_id'); }
    public function toSection()    { return $this->belongsTo(Section::class, 'to_section_id'); }
    public function transferredBy(){ return $this->belongsTo(User::class, 'transferred_by'); }
    public function reworkFor()    { return $this->belongsTo(SectionHandoff::class, 'rework_for_id'); }
    public function files()        { return $this->hasMany(SectionHandoffFile::class)->orderBy('id'); }

    public function scopeForward($q)        { return $q->where('direction', 'forward'); }
    public function scopeBackward($q)       { return $q->where('direction', 'backward'); }
    public function scopeReworkReturn($q)   { return $q->where('direction', 'rework_return'); }
}
