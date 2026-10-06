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
    /**
     * Active shops with their sub-sections, each parent immediately followed by
     * its own children, and `parent_name` carried so a flat <select> can show
     * which is which.
     *
     * ⚠️ A flat alphabetical list of sections is unreadable once sub-sections
     * exist — nothing on the row says whether "Milling Section" is a shop or a
     * bench inside one, and posting a person to the wrong level changes what
     * they can do (shop = XEN/AE, bench = that bench's steps only). Every
     * section picker goes through here; don't rebuild the ordering inline.
     *
     * @return \Illuminate\Support\Collection<int,array<string,mixed>>
     */
    public static function hierarchicalOptions(): \Illuminate\Support\Collection
    {
        $all = static::active()->shops()
            ->orderBy('display_order')->get(['id', 'name', 'code', 'parent_id']);

        $byParent = $all->whereNotNull('parent_id')->groupBy('parent_id');
        $nameById = $all->pluck('name', 'id');

        $ordered = collect();
        foreach ($all->whereNull('parent_id') as $top) {
            $ordered->push($top);
            foreach ($byParent->get($top->id, collect()) as $child) {
                $ordered->push($child);
            }
        }
        // A sub-section whose parent is inactive would otherwise disappear.
        foreach ($all->whereNotNull('parent_id') as $child) {
            if (! $ordered->contains('id', $child->id)) $ordered->push($child);
        }

        return $ordered->map(fn ($s) => [
            'id'          => $s->id,
            'name'        => $s->name,
            'code'        => $s->code,
            'parent_id'   => $s->parent_id,
            'parent_name' => $s->parent_id ? ($nameById[$s->parent_id] ?? null) : null,
        ])->values();
    }

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
