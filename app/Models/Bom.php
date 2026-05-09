<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Bom extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'product_id', 'version', 'is_active', 'notes'];

    public function product() { return $this->belongsTo(Product::class); }
    public function items()   { return $this->hasMany(BomItem::class); }
}
