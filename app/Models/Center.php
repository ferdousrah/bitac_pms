<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Center extends Model
{
    protected $fillable = ['name', 'code', 'address', 'phone', 'email', 'is_active'];

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
