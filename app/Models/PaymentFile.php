<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/** Proof attached to a receipt — a bank slip, a cheque scan, a treasury challan. */
class PaymentFile extends Model
{
    protected $fillable = [
        'payment_id', 'path', 'original_name', 'label', 'mime', 'size', 'uploaded_by',
    ];

    public function payment()    { return $this->belongsTo(Payment::class); }
    public function uploadedBy() { return $this->belongsTo(User::class, 'uploaded_by'); }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public function isImage(): bool
    {
        return str_starts_with((string) $this->mime, 'image/');
    }
}
