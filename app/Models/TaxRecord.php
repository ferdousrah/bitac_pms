<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * One deduction a client made at source from a BITAC bill — AIT or VAT —
 * kept by hand with its certificate (BITAC, 2026-11-01).
 */
class TaxRecord extends Model
{
    use HasCenter;

    /** kind => what the screens call it. */
    public const KINDS = [
        'ait' => [
            'title'       => 'AIT Records',
            'subtitle'    => 'Income tax the client deducted at source from our bills',
            'certificate' => 'Certificate No.',
        ],
        'vat' => [
            'title'       => 'VAT Records',
            'subtitle'    => 'VAT the client deducted at source from our bills (মূসক ৬.৬)',
            'certificate' => 'মূসক ৬.৬ / Challan No.',
        ],
    ];

    protected $fillable = [
        'center_id', 'kind', 'customer_id', 'invoice_id', 'bill_ref', 'record_date',
        'certificate_no', 'amount', 'remarks', 'file_path', 'file_name', 'created_by',
    ];

    protected function casts(): array
    {
        return ['record_date' => 'date', 'amount' => 'decimal:2'];
    }

    public function customer()  { return $this->belongsTo(Customer::class); }
    public function invoice()   { return $this->belongsTo(Invoice::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }

    /** The bill as it reads on the list: the system's bill, else what was typed. */
    public function getBillLabelAttribute(): ?string
    {
        return $this->invoice?->invoice_number ?? $this->bill_ref;
    }
}
