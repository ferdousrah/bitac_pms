<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'user_id', 'user_type', 'action', 'model_type',
        'model_id', 'old_values', 'new_values', 'ip_address',
    ];

    protected function casts(): array
    {
        return ['old_values' => 'array', 'new_values' => 'array'];
    }

    public function user() { return $this->belongsTo(User::class); }
}
