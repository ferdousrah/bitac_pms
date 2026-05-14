<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'name', 'code', 'unit', 'description', 'category'];

    public function boms()       { return $this->hasMany(Bom::class); }
    public function workOrders() { return $this->hasMany(WorkOrder::class); }
    public function rfqs()       { return $this->hasMany(Rfq::class); }

    /**
     * The product's currently active BOM — referenced by Work Order Create and
     * elsewhere. Prefers an explicitly-flagged active row; falls back to the
     * latest BOM so the relation always resolves to something usable.
     */
    public function activeBom()
    {
        return $this->hasOne(Bom::class)->where('is_active', true)->latest('id');
    }
}
