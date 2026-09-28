<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * মূসক ৬.৩ — কর চালানপত্র (the NBR VAT challan).
 *
 * Its figures are stored rather than derived from the invoice it came from: it
 * is a legal document, and what it printed must stay what it printed.
 */
class MusakChallan extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'invoice_id', 'delivery_order_id', 'work_order_id', 'customer_id',
        'challan_no', 'issue_date', 'issue_time',
        'supplier_name', 'supplier_bin', 'supplier_address',
        'buyer_name', 'buyer_bin', 'buyer_address',
        'destination', 'vehicle',
        'total_value', 'total_sd', 'total_vat', 'total_inclusive',
        'signatory_user_id', 'signature_path', 'note',
        'status', 'issued_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'issued_at'  => 'datetime',
        ];
    }

    public function items()     { return $this->hasMany(MusakChallanItem::class)->orderBy('sort_order'); }
    public function invoice()   { return $this->belongsTo(Invoice::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function signatory() { return $this->belongsTo(User::class, 'signatory_user_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }

    /** The next number for this centre's register — editable, like a gate pass. */
    public static function generateChallanNo(?int $centerId): string
    {
        $max = static::withoutGlobalScopes()
            ->when($centerId, fn ($q) => $q->where('center_id', $centerId))
            ->whereYear('created_at', now()->year)
            ->count();

        return (string) ($max + 1);
    }
}
