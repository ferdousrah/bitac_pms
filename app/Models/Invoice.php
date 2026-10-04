<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'delivery_order_id', 'invoice_number',
        'subtotal', 'discount', 'vat_rate', 'vat_amount', 'tax_rate', 'tax_amount', 'total_amount',
        'status', 'issued_at', 'issued_date', 'due_date', 'payment_terms',
        'paid_at', 'paid_amount', 'payment_method', 'payment_reference',
        'payment_notes', 'marked_paid_by',
        // The Accounts Officer's signature on the bill itself — see
        // migration 000056 for why this is not the letter's signature.
        'accounts_signature_path', 'accounts_signed_by', 'accounts_signed_at',
        // The forwarding letter that travels with the bill.
        'memo_no', 'forwarding_letter_subject', 'forwarding_letter', 'recipient_block',
        'customer_ref_no', 'customer_ref_date', 'signatory_user_id', 'signature_path',
        'letter_issued_at', 'emailed_at',
    ];

    protected function casts(): array
    {
        return [
            'issued_at'         => 'datetime',
            'paid_at'           => 'datetime',
            'paid_amount'       => 'decimal:2',
            'customer_ref_date' => 'date',
            'letter_issued_at'  => 'datetime',
            'accounts_signed_at' => 'datetime',
            'emailed_at'        => 'datetime',
        ];
    }

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function customer()      { return $this->belongsTo(Customer::class); }
    public function deliveryOrder() { return $this->belongsTo(DeliveryOrder::class); }
    public function markedPaidBy()  { return $this->belongsTo(User::class, 'marked_paid_by'); }
    public function musakChallans() { return $this->hasMany(MusakChallan::class); }
    /**
     * The money against this bill. ⚠️ Read it through App\Services\PaymentLedger —
     * summing gross_amount here double counts an applied advance, and ignores
     * that a security deduction does not settle the bill.
     */
    public function payments()      { return $this->hasMany(Payment::class)->orderBy('paid_on')->orderBy('id'); }
    public function signatory()     { return $this->belongsTo(User::class, 'signatory_user_id'); }
    public function accountsSignedBy() { return $this->belongsTo(User::class, 'accounts_signed_by'); }

    /** Has the accounts desk signed the bill itself (not the letter)? */
    public function isAccountsSigned(): bool
    {
        return trim((string) $this->accounts_signature_path) !== '';
    }
}
