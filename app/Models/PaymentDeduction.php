<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line cut out of a payment — security, tax at source, a penalty.
 *
 * Whether it leaves a due is decided by the TYPE's `is_recoverable`, not by
 * anything stored here; see PaymentDeductionType.
 *
 * `released_by_payment_id` is how a recoverable deduction is closed out: the
 * release is itself a payment (cash arriving), and stamping it here makes
 * "security still held" a plain subtraction instead of a guess.
 */
class PaymentDeduction extends Model
{
    protected $fillable = [
        'payment_id', 'deduction_type_id', 'amount', 'note', 'released_by_payment_id',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function payment()  { return $this->belongsTo(Payment::class); }
    public function type()     { return $this->belongsTo(PaymentDeductionType::class, 'deduction_type_id'); }
    public function releasedBy() { return $this->belongsTo(Payment::class, 'released_by_payment_id'); }

    /** Held money that has not come back yet. */
    public function scopeOutstandingSecurity($query)
    {
        return $query->whereNull('released_by_payment_id')
            ->whereHas('type', fn ($t) => $t->where('is_recoverable', true));
    }

    public function isReleased(): bool
    {
        return $this->released_by_payment_id !== null;
    }
}
