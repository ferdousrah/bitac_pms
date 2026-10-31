<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkOrderSection extends Model
{
    public const MATERIAL_STATUSES = [
        'received'           => 'Material received',
        'partially_received' => 'Material partly received',
        'not_received'       => 'Material not received',
    ];

    public function materialMarkedBy() { return $this->belongsTo(User::class, 'material_marked_by'); }

    /**
     * The requisitions that bring material to THIS shop for this job: the job's
     * own, either addressed to this shop or to no shop in particular.
     */
    public function incomingRequisitions()
    {
        return MaterialRequisition::with('items')
            ->where('work_order_id', $this->work_order_id)
            ->where(fn ($q) => $q->whereNull('section_id')->orWhere('section_id', $this->section_id))
            ->where('status', '!=', 'cancelled')
            ->orderBy('id');
    }

    /** Belongs to a centre through its job — see WorkOrderCenterScope. */
    protected static function booted(): void
    {
        static::addGlobalScope(new \App\Scopes\WorkOrderCenterScope());
    }

    protected $fillable = [
        'work_order_id', 'section_id', 'sequence', 'weight_pct', 'received_qty', 'forwarded_qty', 'item_ledger', 'status',
        'started_at', 'completed_at', 'completed_by', 'notes', 'work_hours', 'qc_notes', 'remarks',
        'bottleneck_at', 'bottleneck_reason', 'bottleneck_by',
        // WARNING: mass assignment drops anything missing from this list
        // SILENTLY - the forward would appear to work while nothing was written.
        'assigned_to', 'assigned_by', 'assigned_at', 'received_at', 'assign_note',
        // Has the material for this job arrived at this shop (2026-10-23).
        'material_status', 'material_note', 'material_marked_by', 'material_marked_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at'    => 'datetime',
            'completed_at'  => 'datetime',
            'material_marked_at' => 'datetime',
            'weight_pct'    => 'decimal:2',
            'received_qty'  => 'decimal:2',
            'forwarded_qty' => 'decimal:2',
            'item_ledger'   => 'array',
            'bottleneck_at' => 'datetime',
            'assigned_at'   => 'datetime',
            'received_at'   => 'datetime',
        ];
    }

    /**
     * A section is LOCKED for rerouting once it has been touched — completed,
     * skipped, actively worked, or holding/producing/forwarding quantity. Only
     * pristine (pending/ready with nothing received/produced) sections can be
     * freely reordered by PCD.
     */
    public function isReorderable(): bool
    {
        if (in_array($this->status, ['completed', 'skipped', 'in_progress', 'rework', 'awaiting_rework'], true)) return false;
        if ($this->received_qty !== null && (float) $this->received_qty > 0) return false;
        if ((float) $this->forwarded_qty > 0) return false;
        if ($this->sectionOutputQty() > 0) return false;
        return true;
    }

    /**
     * Completion fraction (0–1) of this section, by quantity. Averages the
     * progress fraction of every operation step parked at this section across
     * all of the work order's operation sheets. Falls back to the section's own
     * status when it has no operation steps (e.g. a QC-only stop).
     */
    public function progressFraction(): float
    {
        $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
        if (!$wo) return $this->statusFraction();

        $sheets = $wo->relationLoaded('operationSheets') ? $wo->operationSheets : $wo->operationSheets()->with('steps')->get();
        $steps = $sheets->flatMap(fn ($sh) => $sh->relationLoaded('steps') ? $sh->steps : $sh->steps()->get())
            ->where('section_id', $this->section_id);

        if ($steps->isEmpty()) return $this->statusFraction();

        return min(1.0, $steps->avg(fn ($s) => $s->progressFraction()));
    }

    private function statusFraction(): float
    {
        return match ($this->status) {
            'completed'   => 1.0,
            'in_progress' => 0.5,
            default       => 0.0,
        };
    }

    /** This WO's operation steps parked at this section (across all sheets). */
    public function sectionSteps(): \Illuminate\Support\Collection
    {
        $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
        if (!$wo) return collect();
        $sheets = $wo->relationLoaded('operationSheets') ? $wo->operationSheets : $wo->operationSheets()->with('steps')->get();
        return $sheets->flatMap(fn ($sh) => $sh->relationLoaded('steps') ? $sh->steps : $sh->steps()->get())
            ->where('section_id', $this->section_id)
            ->values();
    }

    /*
     * ── Item by item (BITAC, 2026-10-31) ─────────────────────────────────────
     * Each item of a job moves through the shops ON ITS OWN. An item is its
     * operation sheet (one per job item), and its "lane" at this section is
     * that sheet's steps here. `item_ledger` = {sheet_id: {r: received, f:
     * forwarded}} records each lane's quantities, so a finished item can go on
     * while another is still being worked. The job-level figures below are the
     * SUM of the lanes — for a one-item job, exactly what they always were.
     *
     * ⚠️ They used to be one figure for the whole job: the output was the MIN
     * completed across every step of every item, so one unfinished item held
     * every other item at the shop.
     */

    /** sheet_id => that item's steps at this section. */
    public function lanes(): \Illuminate\Support\Collection
    {
        return $this->sectionSteps()->groupBy('operation_sheet_id');
    }

    private function laneSteps(int $sheetId): \Illuminate\Support\Collection
    {
        return $this->sectionSteps()->where('operation_sheet_id', $sheetId);
    }

    private function ledgerValue(int $sheetId, string $key): ?float
    {
        $v = ($this->item_ledger ?? [])[$sheetId][$key] ?? ($this->item_ledger ?? [])[(string) $sheetId][$key] ?? null;
        return $v === null ? null : (float) $v;
    }

    /** Pieces of this item that have cleared EVERY operation of it here. */
    public function itemOutputQty(int $sheetId): float
    {
        $steps = $this->laneSteps($sheetId);
        return $steps->isEmpty() ? 0.0 : (float) $steps->min(fn ($s) => (float) $s->completed_qty);
    }

    /** How much of this item the section has to do (min target of its steps here). */
    public function itemTargetQty(int $sheetId): float
    {
        $steps = $this->laneSteps($sheetId);
        return $steps->isEmpty() ? 0.0 : (float) $steps->min(fn ($s) => (float) ($s->target_qty ?? 0));
    }

    public function itemForwardedQty(int $sheetId): float
    {
        return $this->ledgerValue($sheetId, 'f') ?? 0.0;
    }

    /** Done here, not yet transferred on. */
    public function itemForwardableQty(int $sheetId): float
    {
        return max(0.0, $this->itemOutputQty($sheetId) - $this->itemForwardedQty($sheetId));
    }

    /**
     * How much of this item has arrived here. **null = ungated**: no section
     * before this one has work on the item, so it starts here from the raw
     * material — including an item that skips the shops before this one.
     */
    public function itemReceivedQty(int $sheetId): ?float
    {
        if (($r = $this->ledgerValue($sheetId, 'r')) !== null) return $r;
        // A row moved before the ledger existed (and not backfilled): the job's figure.
        if (empty($this->item_ledger) && $this->received_qty !== null) return (float) $this->received_qty;
        return $this->hasWorkUpstream($sheetId) ? 0.0 : null;
    }

    private ?array $upstreamSectionIds = null;

    /** Does any section BEFORE this one in the routing have work on this item? */
    public function hasWorkUpstream(int $sheetId): bool
    {
        if ($this->upstreamSectionIds === null) {
            $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
            $all = $wo && $wo->relationLoaded('sections') ? $wo->sections : static::where('work_order_id', $this->work_order_id)->get();
            $this->upstreamSectionIds = $all->where('sequence', '<', $this->sequence)->pluck('section_id')->all();
        }
        if ($this->upstreamSectionIds === []) return false;

        $wo = $this->relationLoaded('workOrder') ? $this->workOrder : $this->workOrder()->first();
        $sheet = $wo?->operationSheets->firstWhere('id', $sheetId);
        return (bool) $sheet?->steps->whereIn('section_id', $this->upstreamSectionIds)->isNotEmpty();
    }

    /** Has every item here been passed on in full? */
    public function allItemsForwarded(): bool
    {
        $lanes = $this->lanes();
        if ($lanes->isEmpty()) return false;
        foreach ($lanes->keys() as $sheetId) {
            $t = $this->itemTargetQty((int) $sheetId);
            if ($t <= 0 || $this->itemForwardedQty((int) $sheetId) < $t - 0.001) return false;
        }
        return true;
    }

    /** Finished output of this section — every item's, added up. */
    public function sectionOutputQty(): float
    {
        return (float) $this->lanes()->keys()->sum(fn ($id) => $this->itemOutputQty((int) $id));
    }

    /** What this section has to do — every item's target, added up. */
    public function sectionTargetQty(): float
    {
        return (float) $this->lanes()->keys()->sum(fn ($id) => $this->itemTargetQty((int) $id));
    }

    /** Passed on so far — every item's, added up. */
    public function forwardedQtyTotal(): float
    {
        $lanes = $this->lanes();
        if ($lanes->isEmpty()) return (float) $this->forwarded_qty;
        return (float) $lanes->keys()->sum(fn ($id) => $this->itemForwardedQty((int) $id));
    }

    /** Pieces done here but not yet transferred downstream (all items). */
    public function forwardableQty(): float
    {
        return (float) $this->lanes()->keys()->sum(fn ($id) => $this->itemForwardableQty((int) $id));
    }

    /** Is this the first section in the WO's routing? (raw material — ungated). */
    public function isFirstInRouting(): bool
    {
        return !static::where('work_order_id', $this->work_order_id)
            ->where('sequence', '<', $this->sequence)
            ->exists();
    }

    /**
     * How much this section is allowed to work on: what it received from
     * upstream. The first section is ungated (has the raw material). A
     * downstream section with no received_qty yet is gated at 0.
     */
    public function effectiveReceivedQty(): ?float
    {
        // A stop with no operations (QC): the job-level figure, as always.
        $lanes = $this->lanes();
        if ($lanes->isEmpty()) {
            if ($this->received_qty !== null) return (float) $this->received_qty;
            return $this->isFirstInRouting() ? null : 0.0; // null = unlimited
        }
        // Every item's arrival added up; null only when no item is gated here.
        $gated = false; $sum = 0.0;
        foreach ($lanes->keys() as $id) {
            $r = $this->itemReceivedQty((int) $id);
            if ($r === null) { $sum += $this->itemTargetQty((int) $id); continue; }
            $gated = true; $sum += $r;
        }
        return $gated ? $sum : null;
    }

    public function workOrder()   { return $this->belongsTo(WorkOrder::class); }

    /** The assistant engineer who owns this job at this shop. */
    public function assignedTo() { return $this->belongsTo(User::class, 'assigned_to'); }
    public function assignedBy() { return $this->belongsTo(User::class, 'assigned_by'); }

    public function isAssigned(): bool { return $this->assigned_to !== null; }
    public function isReceived(): bool { return $this->received_at !== null; }

    /** Handed over but not yet taken in hand - two different facts. */
    public function awaitingReceipt(): bool
    {
        return $this->isAssigned() && ! $this->isReceived();
    }
    public function section()     { return $this->belongsTo(Section::class); }
    public function completedBy() { return $this->belongsTo(User::class, 'completed_by'); }
    public function bottleneckBy(){ return $this->belongsTo(User::class, 'bottleneck_by'); }

    public function scopePending($query)    { return $query->where('status', 'pending'); }
    public function scopeReady($query)      { return $query->where('status', 'ready'); }
    public function scopeInProgress($query) { return $query->where('status', 'in_progress'); }
    public function scopeCompleted($query)  { return $query->where('status', 'completed'); }
    public function scopeRework($query)     { return $query->where('status', 'rework'); }

    /** A WOS that the supervisor of $sectionId should see on their queue. */
    public function scopeActiveForSection($query, int $sectionId)
    {
        return $query->where('section_id', $sectionId)
                     ->whereIn('status', ['ready', 'in_progress', 'rework', 'awaiting_rework']);
    }
}
