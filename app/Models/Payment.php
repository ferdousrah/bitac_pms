<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * One money event against a client.
 *
 * ⚠️ **Read `kind` before doing arithmetic with these rows.** Every row moves
 * either cash or the advance pool, never both:
 *
 *   advance          cash in, no bill yet            → +pool
 *   against_bill     cash in, settles a bill
 *   advance_applied  NO cash, settles a bill         → −pool
 *   security_release cash in, releases a retention
 *
 * So summing `gross_amount` over every row double counts an advance that has
 * been applied. `App\Services\PaymentLedger` is the one place that knows these
 * rules — use it rather than re-deriving them.
 */
class Payment extends Model
{
    use HasCenter;

    /** Cash really arrived (so an applied advance is not counted twice). */
    public const CASH_KINDS = ['advance', 'against_bill', 'security_release'];

    /** This row settles part of a bill. */
    public const SETTLING_KINDS = ['against_bill', 'advance_applied', 'security_release'];

    public const KIND_LABELS = [
        'advance'          => 'Advance',
        'against_bill'     => 'Against bill',
        'advance_applied'  => 'Advance applied',
        'security_release' => 'Security released',
    ];

    public const METHODS = [
        'cash'          => 'Cash',
        'cheque'        => 'Cheque',
        'bank_transfer' => 'Bank Transfer',
        'dd'            => 'Demand Draft',
        'online'        => 'Online / Mobile Banking',
        'treasury'      => 'Treasury Challan',
        'adjustment'    => 'Adjustment',
        'other'         => 'Other',
    ];

    protected $fillable = [
        'center_id', 'customer_id', 'work_order_id', 'invoice_id',
        'payment_no', 'kind', 'paid_on', 'gross_amount',
        'method', 'bank_branch', 'reference', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'paid_on'      => 'date',
            'gross_amount' => 'decimal:2',
        ];
    }

    public function customer()   { return $this->belongsTo(Customer::class); }
    public function workOrder()  { return $this->belongsTo(WorkOrder::class); }
    public function invoice()    { return $this->belongsTo(Invoice::class); }
    public function recordedBy() { return $this->belongsTo(User::class, 'recorded_by'); }
    public function deductions() { return $this->hasMany(PaymentDeduction::class); }
    public function files()      { return $this->hasMany(PaymentFile::class); }

    /** Deductions this payment released (it is a security_release). */
    public function releasedDeductions()
    {
        return $this->hasMany(PaymentDeduction::class, 'released_by_payment_id');
    }

    public function scopeCash($query)      { return $query->whereIn('kind', self::CASH_KINDS); }
    public function scopeSettling($query)  { return $query->whereIn('kind', self::SETTLING_KINDS); }

    public function getKindLabelAttribute(): string
    {
        return self::KIND_LABELS[$this->kind] ?? ucfirst(str_replace('_', ' ', (string) $this->kind));
    }

    public function getMethodLabelAttribute(): ?string
    {
        return $this->method ? (self::METHODS[$this->method] ?? ucfirst($this->method)) : null;
    }

    /** Everything cut out of the payment. */
    public function deductionTotal(): float
    {
        return (float) $this->deductions->sum('amount');
    }

    /** Cash that actually reached BITAC. */
    public function netAmount(): float
    {
        return round((float) $this->gross_amount - $this->deductionTotal(), 2);
    }

    /**
     * How much of the bill this row settles.
     *
     * ⚠️ A recoverable deduction (security held) does NOT settle the bill —
     * the client still owes it. Everything else does, including tax deducted
     * at source, which went to the treasury on BITAC's behalf.
     */
    public function settledAmount(): float
    {
        if (! in_array($this->kind, self::SETTLING_KINDS, true)) {
            return 0.0;
        }

        $held = (float) $this->deductions
            ->filter(fn ($d) => (bool) $d->type?->is_recoverable)
            ->sum('amount');

        return round((float) $this->gross_amount - $held, 2);
    }

    /** Money the client is holding back out of this payment. */
    public function recoverableTotal(): float
    {
        return round((float) $this->deductions
            ->filter(fn ($d) => (bool) $d->type?->is_recoverable)
            ->sum('amount'), 2);
    }

    /**
     * The next number in the register. Suggested, not imposed — the form
     * pre-fills it and the officer can carry a number from their own book
     * (the gate pass convention).
     */
    public static function suggestNo(): string
    {
        $prefix = 'RCV-' . now()->format('Y') . '-';

        $last = static::withoutGlobalScopes()
            ->where('payment_no', 'like', $prefix . '%')
            ->orderByDesc('payment_no')
            ->value('payment_no');

        $n = $last ? ((int) substr((string) $last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
