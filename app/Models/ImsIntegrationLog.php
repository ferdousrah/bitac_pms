<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImsIntegrationLog extends Model
{
    protected $fillable = [
        'query_type', 'request_payload', 'response_payload', 'status',
    ];

    protected function casts(): array
    {
        return [
            'request_payload'  => 'array',
            'response_payload' => 'array',
        ];
    }
}
