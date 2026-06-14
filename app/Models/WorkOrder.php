<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class WorkOrder extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'wo_number', 'job_number', 'rfq_id', 'quotation_id', 'customer_id', 'product_id',
        'job_category_id',
        'section_id', 'bom_id', 'quantity', 'priority', 'status', 'due_date', 'notes', 'department', 'customer_po_no', 'created_by', 'prepared_by',
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
            'ied_pending'        => 'Awaiting IED Acceptance',
            'pcd_pending'        => 'In Production Planning',
            'released_to_shops'  => 'Released to Shops',
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
            'ied_pending'        => 'amber',
            'pcd_pending'        => 'blue',
            'released_to_shops'  => 'indigo',
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
    public function jobCategory()  { return $this->belongsTo(JobCategory::class); }
    public function product()      { return $this->belongsTo(Product::class); }
    public function rfq()          { return $this->belongsTo(Rfq::class); }
    public function quotation()    { return $this->belongsTo(Quotation::class); }
    public function bom()          { return $this->belongsTo(Bom::class); }
    public function createdBy()    { return $this->belongsTo(User::class, 'created_by'); }
    public function preparedBy()   { return $this->belongsTo(User::class, 'prepared_by'); }
    public function pcdHandoffBy() { return $this->belongsTo(User::class, 'pcd_handoff_by'); }
    public function cancelledBy()  { return $this->belongsTo(User::class, 'cancelled_by'); }

    public function files()               { return $this->hasMany(WorkOrderFile::class)->orderBy('id'); }
    public function customerPoFile()      { return $this->hasOne(WorkOrderFile::class)->where('kind', 'customer_po')->latest('id'); }

    public function items()               { return $this->hasMany(WorkOrderItem::class)->orderBy('display_order')->orderBy('id'); }
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
        // Item-wise gate: every item must have an operation sheet with at least
        // one step. Legacy WOs without items table rows fall back to "any sheet".
        $itemIds = $this->items()->pluck('id');
        if ($itemIds->isEmpty()) {
            return $this->operationSheets()->whereHas('steps')->exists();
        }
        $coveredItemIds = $this->operationSheets()
            ->whereHas('steps')
            ->whereNotNull('work_order_item_id')
            ->pluck('work_order_item_id');
        return $itemIds->diff($coveredItemIds)->isEmpty();
    }

    /**
     * Item IDs that still need an operation sheet. Drives the JobDetail step 3
     * per-item action list (one "Create Operation Sheet" entry per missing item).
     */
    public function itemsMissingOperationSheet(): \Illuminate\Support\Collection
    {
        $itemIds = $this->items()->pluck('id');
        if ($itemIds->isEmpty()) return collect();
        $coveredItemIds = $this->operationSheets()
            ->whereHas('steps')
            ->whereNotNull('work_order_item_id')
            ->pluck('work_order_item_id');
        return $itemIds->diff($coveredItemIds)->values();
    }

    public function getPcdProgressAttribute(): array
    {
        return [
            'mr'         => $this->has_material_requisition,
            'sections'   => $this->has_section_assignment,
            'op_sheet'   => $this->has_operation_sheet,
            // MR is optional — release only requires Section Assignment + Operation Sheets.
            // PCD officer can still raise an MR later (e.g. when material runs out
            // during production), but the job doesn't have to wait for it to ship.
            'all_done'   => $this->has_section_assignment && $this->has_operation_sheet,
        ];
    }

    /**
     * Weighted production progress, 0-100. Returns null for cancelled WOs.
     * Mirrors DashboardController/ReportController logic; uses the first
     * operation sheet's steps with their weight_pct. Falls back to equal
     * weighting when no weights are set. In-progress steps count as half.
     */
    public function getProductionProgressAttribute(): ?int
    {
        if (in_array($this->status, ['qc_passed', 'ready_for_delivery', 'delivered'], true)) return 100;
        if ($this->status === 'cancelled') return null;

        $sheet = $this->operationSheets->first() ?? $this->operationSheets()->with('steps')->first();
        if (!$sheet) return 0;

        $steps = $sheet->relationLoaded('steps') ? $sheet->steps : $sheet->steps()->get();
        if ($steps->isEmpty()) return 0;

        $weightSum = $steps->sum(fn ($s) => (float) $s->weight_pct);
        if ($weightSum > 0) {
            $done = $steps->where('status', 'completed')->sum(fn ($s) => (float) $s->weight_pct);
            $wip  = $steps->where('status', 'in_progress')->sum(fn ($s) => (float) $s->weight_pct);
            return (int) round(min(100, $done + $wip * 0.5));
        }
        $total = $steps->count();
        $done  = $steps->where('status', 'completed')->count();
        $wip   = $steps->where('status', 'in_progress')->count();
        return (int) round((($done + $wip * 0.5) / $total) * 100);
    }

    /**
     * Compact step list for customer-facing progress views.
     * [{sequence, operation, status, done_qty?, total_qty?}, ...]
     */
    public function progressStepsSummary(): array
    {
        $sheet = $this->operationSheets->first() ?? $this->operationSheets()->with('steps')->first();
        if (!$sheet) return [];

        $steps = $sheet->relationLoaded('steps') ? $sheet->steps : $sheet->steps()->orderBy('sequence')->get();
        return $steps->sortBy('sequence')->values()->map(fn ($s) => [
            'sequence'  => (int) $s->sequence,
            'operation' => $s->operation_name ?: ($s->operation?->name ?? 'Operation'),
            'status'    => $s->status,
            'weight'    => (float) ($s->weight_pct ?? 0),
        ])->all();
    }
}
