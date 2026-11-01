<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * A money receipt — what BITAC hands an organisation that pays in cash or by
 * cheque (BITAC, 2026-11-01). The receipt book, kept here; it does NOT touch
 * the payment ledger (PaymentLedger), so it moves no bill's dues.
 *
 * A receipt that went wrong is CANCELLED, never deleted — a gap in a receipt
 * book is exactly what an audit asks about.
 */
class MoneyReceipt extends Model
{
    use HasCenter;

    public const METHODS = ['cash' => 'Cash', 'cheque' => 'Cheque'];

    protected $fillable = [
        'center_id', 'receipt_no', 'receipt_date', 'customer_id', 'payer_name', 'purpose',
        'method', 'cheque_no', 'cheque_date', 'bank_name', 'received_through', 'amount', 'details',
        'invoice_id', 'status', 'cancel_reason', 'cancelled_by', 'cancelled_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'receipt_date' => 'date',
            'cheque_date'  => 'date',
            'cancelled_at' => 'datetime',
            'amount'       => 'decimal:2',
        ];
    }

    public function customer()    { return $this->belongsTo(Customer::class); }
    public function invoice()     { return $this->belongsTo(Invoice::class); }
    public function createdBy()   { return $this->belongsTo(User::class, 'created_by'); }
    public function cancelledBy() { return $this->belongsTo(User::class, 'cancelled_by'); }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /** `RCT-DHK-2026-0001` — the centre's own series; a number from the paper book may be typed instead. */
    public static function suggestNo(?int $centerId = null): string
    {
        return \App\Support\DocNumber::next('money_receipts', 'receipt_no', 'RCT', $centerId);
    }
}
