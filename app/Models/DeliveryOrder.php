<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class DeliveryOrder extends Model
{
    use HasCenter;

    /** A delivery in any of these has goods committed to it (not free to send again). */
    public const COMMITTED = ['scheduled', 'dispatched', 'delivered'];

    /** Full = every item of the job at once; partial = anything less (Partial Challan). */
    public const TYPES = ['full' => 'Full delivery', 'partial' => 'Partial delivery'];

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'challan_number', 'quantity_delivered', 'delivery_type',
        'scheduled_date', 'delivery_address', 'vehicle_number', 'driver_name', 'notes',
        'status', 'delivered_at',
        // Signed by PCD's নির্বাহী প্রকৌশলী before the goods go — ChallanApproval.
        'created_by', 'challan_status', 'challan_approved_by', 'challan_approved_at', 'challan_signature_path',
        'challan_rejected_by', 'challan_rejected_at', 'challan_rejection_reason',
    ];

    public const CHALLAN_STATUSES = [
        'pending'  => 'Awaiting XEN signature',
        'approved' => 'Signed',
        'rejected' => 'Rejected',
    ];

    /** Signed (or from before signing was asked for) — may go out, be confirmed and be billed. */
    public function isChallanSigned(): bool
    {
        return $this->challan_status === null || $this->challan_status === 'approved';
    }

    /** Scope: challans accounts may see — signed ones only. */
    public function scopeChallanSigned($q)
    {
        return $q->where(fn ($w) => $w->whereNull('challan_status')->orWhere('challan_status', 'approved'));
    }

    public function createdBy()        { return $this->belongsTo(User::class, 'created_by'); }
    public function challanApprovedBy() { return $this->belongsTo(User::class, 'challan_approved_by'); }
    public function challanRejectedBy() { return $this->belongsTo(User::class, 'challan_rejected_by'); }

    protected function casts(): array
    {
        return ['scheduled_date' => 'date', 'delivered_at' => 'datetime', 'quantity_delivered' => 'float',
            'challan_approved_at' => 'datetime', 'challan_rejected_at' => 'datetime'];
    }

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function pod()       { return $this->hasOne(ProofOfDelivery::class, 'delivery_order_id'); }
    public function invoice()   { return $this->hasOne(Invoice::class, 'delivery_order_id'); }
    public function items()     { return $this->hasMany(DeliveryOrderItem::class)->orderBy('sort_order'); }

    /**
     * full | partial. Recorded on deliveries made since 2026-10-24; older ones
     * are worked out from their quantity against the order.
     */
    public function getTypeAttribute(): string
    {
        if ($this->delivery_type) {
            return $this->delivery_type;
        }
        $ordered = (float) ($this->workOrder?->quantity ?? 0);

        return $ordered > 0 && (float) $this->quantity_delivered >= $ordered - 0.001 ? 'full' : 'partial';
    }

    public function getTypeLabelAttribute(): string
    {
        return self::TYPES[$this->type];
    }
}
