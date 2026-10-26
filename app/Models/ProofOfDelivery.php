<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProofOfDelivery extends Model
{
    protected $fillable = [
        'delivery_order_id', 'received_by', 'receiver_designation', 'receiver_phone',
        // signature (drawn on the link / tablet) | photo (the pen-signed paper challan)
        'proof_type', 'proof_path', 'delivered_at', 'notes', 'signed_ip',
    ];

    public function isSignature(): bool { return $this->proof_type === 'signature'; }

    public function getProofUrlAttribute(): ?string
    {
        return $this->proof_path ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->proof_path) : null;
    }

    protected function casts(): array
    {
        return ['delivered_at' => 'datetime'];
    }

    public function deliveryOrder()
    {
        return $this->belongsTo(DeliveryOrder::class);
    }
}
