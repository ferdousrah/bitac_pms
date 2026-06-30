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
     * Section-weighted production progress, 0-100. Returns null for cancelled WOs.
     *
     * Each routing section carries a weight_pct (PCD-assigned, sums to 100). A
     * section's own completion is the quantity-average of its operation steps
     * (WorkOrderSection::progressFraction()). Overall progress is therefore
     * Σ(section_weight × section_completion) / Σ(section_weight). When no
     * section weights are set, sections are weighted equally.
     */
    public function getProductionProgressAttribute(): ?int
    {
        if (in_array($this->status, ['qc_passed', 'ready_for_delivery', 'delivered'], true)) return 100;
        if ($this->status === 'cancelled') return null;

        $breakdown = $this->sectionProgressBreakdown();
        if ($breakdown->isEmpty()) return 0;

        $weightSum = $breakdown->sum('weight');
        if ($weightSum > 0) {
            $acc = $breakdown->sum(fn ($b) => $b['weight'] * $b['fraction']);
            return (int) round(min(100, ($acc / $weightSum) * 100));
        }
        // No weights set → equal-weight the sections.
        return (int) round($breakdown->avg('fraction') * 100);
    }

    /**
     * Per-section progress rows used by the WO detail + production views:
     * [{section_id, name, code, weight, fraction, pct, status}, ...]
     */
    public function sectionProgressBreakdown(): \Illuminate\Support\Collection
    {
        $sections = $this->relationLoaded('sections') ? $this->sections : $this->sections()->with('section')->get();
        return $sections->map(function ($wos) {
            $frac = $wos->progressFraction();
            return [
                'section_id' => $wos->section_id,
                'name'       => $wos->section?->name,
                'code'       => $wos->section?->code,
                'weight'     => (float) $wos->weight_pct,
                'fraction'   => $frac,
                'pct'        => (int) round($frac * 100),
                'status'     => $wos->status,
            ];
        })->values();
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
