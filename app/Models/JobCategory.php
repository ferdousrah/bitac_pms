<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class JobCategory extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'name', 'code', 'description', 'display_order', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active'     => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function scopeActive($q) { return $q->where('is_active', true); }

    public function rfqs()         { return $this->hasMany(Rfq::class); }
    public function quotations()   { return $this->hasMany(Quotation::class); }
    public function workOrders()   { return $this->hasMany(WorkOrder::class); }
}
