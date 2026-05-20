<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CostEstimateApproval extends Model
{
    protected $fillable = [
        'cost_estimate_id', 'approver_id', 'level', 'label', 'status', 'remarks',
        'signature_path', 'acted_at',
    ];

    protected function casts(): array
    {
        return ['acted_at' => 'datetime'];
    }

    public function costEstimate() { return $this->belongsTo(CostEstimate::class); }
    public function approver()     { return $this->belongsTo(User::class, 'approver_id'); }

    /**
     * Absolute filesystem path of this approval's captured signature.
     * Used by the PDF generator when embedding the approver's signature.
     */
    public function signatureAbsolutePath(): ?string
    {
        if (!$this->signature_path) return null;
        $path = \Storage::disk('public')->path($this->signature_path);
        return is_file($path) ? $path : null;
    }
}
