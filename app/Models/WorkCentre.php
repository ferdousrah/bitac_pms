<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class WorkCentre extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'name', 'code', 'description'];

    public function machines() { return $this->hasMany(Machine::class); }
}
