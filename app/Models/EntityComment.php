<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class EntityComment extends Model
{
    use HasCenter;

    protected $fillable = [
        'entity_type', 'entity_id', 'user_id', 'body', 'kind', 'center_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForEntity($query, string $type, int $id)
    {
        return $query->where('entity_type', $type)->where('entity_id', $id);
    }
}
