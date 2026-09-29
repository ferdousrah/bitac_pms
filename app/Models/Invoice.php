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
            'emailed_at'        => 'datetime',
        ];
    }

    public function workOrder()     { return $this->belongsTo(WorkOrder::class); }
    public function customer()      { return $this->belongsTo(Customer::class); }
    public function deliveryOrder() { return $this->belongsTo(DeliveryOrder::class); }
    public function markedPaidBy()  { return $this->belongsTo(User::class, 'marked_paid_by'); }
    public function musakChallans() { return $this->hasMany(MusakChallan::class); }
    public function signatory()     { return $this->belongsTo(User::class, 'signatory_user_id'); }
}
