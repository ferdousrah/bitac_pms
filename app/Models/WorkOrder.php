<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class WorkOrder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'wo_number', 'job_number', 'rfq_id', 'quotation_id', 'customer_id', 'product_id',
        'section_id', 'bom_id', 'quantity', 'priority', 'status', 'due_date', 'notes', 'customer_po_no', 'created_by',
        'pcd_handoff_at', 'pcd_handoff_by', 'released_to_shops_at', 'released_by',
        'cancelled_at', 'cancelled_by', 'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'due_date'             => 'date',
            'pcd_handoff_at'       => 'datetime',
            'released_to_shops_at' => 'datetime',
            'cancelled_at'         => 'datetime',
        ];
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_date && now()->gt($this->due_date) && !in_array($this->status, ['delivered', 'cancelled']);
    }

    public function getStatusLabelAttribute(): string
    {
        return match($this->status) {
            'draft'              => 'Draft',
            'approved'           => 'Approved',
            'in_production'      => 'In Production',
            'qc_hold'            => 'QC Hold',
            'qc_passed'          => 'QC Passed',
            'ready_for_delivery' => 'Ready for Delivery',
            'delivered'          => 'Delivered',
            'cancelled'          => 'Cancelled',
            default              => ucfirst($this->status),
        };
    }

    public function getStatusColorAttribute(): string
    {
        return match($this->status) {
            'draft'              => 'gray',
            'approved'           => 'blue',
            'in_production'      => 'yellow',
            'qc_hold'            => 'orange',
            'qc_passed'          => 'teal',
            'ready_for_delivery' => 'indigo',
            'delivered'          => 'green',
            'cancelled'          => 'red',
            default              => 'gray',
        };
    }

    public function section()      { return $this->belongsTo(Section::class); }
    public function customer()     { return $this->belongsTo(Customer::class); }
    public function product()      { return $this->belongsTo(Product::class); }
    public function rfq()          { return $this->belongsTo(Rfq::class); }
    public function quotation()    { return $this->belongsTo(Quotation::class); }
    public function bom()          { return $this->belongsTo(Bom::class); }
    public function createdBy()    { return $this->belongsTo(User::class, 'created_by'); }
    public function cancelledBy()  { return $this->belongsTo(User::class, 'cancelled_by'); }

    public function files()               { return $this->hasMany(WorkOrderFile::class)->orderBy('id'); }
    public function customerPoFile()      { return $this->hasOne(WorkOrderFile::class)->where('kind', 'customer_po')->latest('id'); }

    public function operationSheets()     { return $this->hasMany(OperationSheet::class); }
    public function jobExecutions()       { return $this->hasMany(JobExecution::class); }
    public function qcInspections()       { return $this->hasMany(QcInspection::class); }
    public function ncrs()                { return $this->hasMany(Ncr::class); }
    public function deliveryOrders()      { return $this->hasMany(DeliveryOrder::class); }
    public function invoices()            { return $this->hasMany(Invoice::class); }
    public function materialRequisitions(){ return $this->hasMany(MaterialRequisition::class); }
    public function sections()            { return $this->hasMany(WorkOrderSection::class)->orderBy('sequence'); }

    // ── PCD progress checks (used by PcdReleaseService) ──────────
    public function getHasMaterialRequisitionAttribute(): bool
    {
        // MR is "done from PCD's side" once it's pushed to IMS (approval happens in IMS).
        // Keep `approved/issued/received` for legacy MRs that approved locally.
        return $this->materialRequisitions()
            ->whereIn('status', ['sent_to_ims', 'approved', 'partially_issued', 'issued', 'received'])
            ->exists();
    }

    public function getHasSectionAssignmentAttribute(): bool
    {
        return $this->sections()->exists();
    }

    public function getHasOperationSheetAttribute(): bool
    {
        return $this->operationSheets()->whereHas('steps')->exists();
    }

    public function getPcdProgressAttribute(): array
    {
        return [
            'mr'         => $this->has_material_requisition,
            'sections'   => $this->has_section_assignment,
            'op_sheet'   => $this->has_operation_sheet,
            'all_done'   => $this->has_material_requisition && $this->has_section_assignment && $this->has_operation_sheet,
        ];
    }
}
