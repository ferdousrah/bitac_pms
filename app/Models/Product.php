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
}
