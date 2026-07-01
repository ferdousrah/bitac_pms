<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GatePassApprover extends Model
{
    protected $fillable = ['user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Is the given user allowed to approve PCD gate passes? */
    public static function isApprover(int $userId): bool
    {
        return static::where('user_id', $userId)->exists();
    }
}
