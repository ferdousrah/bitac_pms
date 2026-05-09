<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CostEstimateApproval extends Model
{
    protected $fillable = [
        'cost_estimate_id', 'approver_id', 'level', 'label', 'status', 'remarks', 'acted_at',
    ];

    protected function casts(): array
    {
        return ['acted_at' => 'datetime'];
    }

    public function costEstimate() { return $this->belongsTo(CostEstimate::class); }
    public function approver()     { return $this->belongsTo(User::class, 'approver_id'); }
}
