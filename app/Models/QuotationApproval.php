<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuotationApproval extends Model
{
    protected $fillable = [
        'quotation_id', 'approver_id', 'level', 'status', 'remarks',
        'signature_path', 'approved_at',
        'forwarded_to_user_id', 'forwarded_at', 'forward_reason',
    ];

    protected function casts(): array
    {
        return [
            'approved_at'  => 'datetime',
            'forwarded_at' => 'datetime',
        ];
    }

    public function forwardedTo()
    {
        return $this->belongsTo(User::class, 'forwarded_to_user_id');
    }

    /**
     * Absolute filesystem path of this approval's captured signature.
     * Used by the PDF generator when embedding the signer's signature.
     */
    public function signatureAbsolutePath(): ?string
    {
        if (!$this->signature_path) return null;
        $path = \Storage::disk('public')->path($this->signature_path);
        return is_file($path) ? $path : null;
    }

    public function quotation()
    {
        return $this->belongsTo(Quotation::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
