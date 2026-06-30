<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    protected $fillable = [
        'parent_id', 'code', 'name', 'name_bn', 'type', 'description', 'display_order', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function machines()  { return $this->hasMany(Machine::class); }
    public function operators() { return $this->hasMany(Operator::class); }

    // Sub-section hierarchy (one level deep): a production shop → sub-sections.
    public function parent()    { return $this->belongsTo(Section::class, 'parent_id'); }
    public function children()  { return $this->hasMany(Section::class, 'parent_id')->orderBy('display_order'); }

    public function scopeActive($query)     { return $query->where('is_active', true); }
    public function scopeShops($query)      { return $query->where('type', 'production_shop'); }
    public function scopeFunctional($query) { return $query->where('type', 'functional'); }
    /** Top-level sections only (not sub-sections). */
    public function scopeTopLevel($query)   { return $query->whereNull('parent_id'); }
    /** Sub-sections only. */
    public function scopeSubSections($query){ return $query->whereNotNull('parent_id'); }

    public function isSubSection(): bool { return $this->parent_id !== null; }
}
