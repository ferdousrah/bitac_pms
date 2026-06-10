<?php

namespace App\Models;

use App\Scopes\CenterScope;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceDemandLog extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id',
        'requested_service', 'service_category',
        'requester_name', 'requester_organization', 'requester_contact', 'requester_type',
        'context', 'expected_volume', 'potential_value',
        'logged_by', 'logged_date', 'notes',
    ];

    protected function casts(): array
    {
        return ['logged_date' => 'date'];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new CenterScope);
    }

    public function loggedBy(): BelongsTo { return $this->belongsTo(User::class, 'logged_by'); }

    public function scopeYear($q, int $year)
    {
        return $q->whereYear('logged_date', $year);
    }
}
