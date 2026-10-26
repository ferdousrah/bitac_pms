<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * A shop's request to PCD for material for one job. PCD answers it by raising a
 * material requisition to the store (`material_requisition_id`), or rejects it
 * with a reason. After that the demand's progress IS the requisition's —
 * nothing is copied back, so the two can never disagree.
 */
class MaterialDemand extends Model
{
    use HasCenter;

    public const STATUSES = [
        'submitted' => 'Waiting for PCD',
        'accepted'  => 'MR raised',
        'rejected'  => 'Rejected',
        'cancelled' => 'Cancelled',
    ];

    protected $fillable = [
        'center_id', 'demand_no', 'section_id', 'work_order_id', 'requested_by', 'needed_by',
        'status', 'notes', 'material_requisition_id', 'decided_by', 'decided_at', 'reject_reason',
    ];

    protected function casts(): array
    {
        return [
            'needed_by'  => 'date',
            'decided_at' => 'datetime',
        ];
    }

    public function items()       { return $this->hasMany(MaterialDemandItem::class)->orderBy('id'); }
    public function section()     { return $this->belongsTo(Section::class); }
    public function workOrder()   { return $this->belongsTo(WorkOrder::class); }
    public function requestedBy() { return $this->belongsTo(User::class, 'requested_by'); }
    public function decidedBy()   { return $this->belongsTo(User::class, 'decided_by'); }
    public function requisition() { return $this->belongsTo(MaterialRequisition::class, 'material_requisition_id'); }

    public function getStatusLabelAttribute(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst((string) $this->status);
    }

    /** Still open to the shop to change or withdraw — PCD has not answered. */
    public function isOpen(): bool
    {
        return $this->status === 'submitted';
    }

    /** `MD-DHK-2026-0004` — the centre's own series (App\Support\DocNumber). */
    public static function generateNo(?int $centerId = null): string
    {
        return \App\Support\DocNumber::next('material_demands', 'demand_no', 'MD', $centerId);
    }
}
