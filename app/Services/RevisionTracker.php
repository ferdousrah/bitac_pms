<?php

namespace App\Services;

use App\Models\CostEstimate;
use App\Models\EntityRevision;
use App\Models\Quotation;
use Illuminate\Database\Eloquent\Model;

/**
 * RevisionTracker — records a snapshot of a cost estimate or quotation every
 * time something significant happens. Powers the change-management timeline.
 */
class RevisionTracker
{
    /**
     * Record a new revision for a cost estimate.
     */
    public function trackEstimate(CostEstimate $estimate, string $event, ?string $reason = null): ?EntityRevision
    {
        return $this->track('cost_estimate', $estimate, $event, $reason);
    }

    /**
     * Record a new revision for a quotation.
     */
    public function trackQuotation(Quotation $quotation, string $event, ?string $reason = null): ?EntityRevision
    {
        return $this->track('quotation', $quotation, $event, $reason);
    }

    /**
     * Core tracking logic.
     */
    private function track(string $type, Model $entity, string $event, ?string $reason): ?EntityRevision
    {
        try {
            $nextNo = EntityRevision::where('entity_type', $type)
                ->where('entity_id', $entity->id)
                ->max('revision_no') + 1;

            $snapshot = $this->buildSnapshot($type, $entity);

            // Diff vs last revision (if any)
            $previous = EntityRevision::where('entity_type', $type)
                ->where('entity_id', $entity->id)
                ->orderByDesc('revision_no')
                ->first();

            $changes = null;
            $autoSummary = null;
            if ($previous) {
                $changes = $this->computeDiff($previous->snapshot ?? [], $snapshot);
                $autoSummary = $this->summarizeDiff($changes, $previous->grand_total_at, $snapshot['grand_total'] ?? null);
            }

            return EntityRevision::create([
                'entity_type'    => $type,
                'entity_id'      => $entity->id,
                'revision_no'    => $nextNo,
                'event'          => $event,
                'snapshot'       => $snapshot,
                'changes'        => $changes,
                'grand_total_at' => $snapshot['grand_total'] ?? $snapshot['total_amount'] ?? null,
                'changed_by'     => auth()->id(),
                'change_reason'  => $reason,
                'auto_summary'   => $autoSummary,
                'center_id'      => $entity->center_id ?? null,
            ]);
        } catch (\Throwable $e) {
            \Log::warning('Revision tracking failed', [
                'type'  => $type,
                'id'    => $entity->id,
                'event' => $event,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Build a full JSON snapshot of the entity including line items.
     */
    private function buildSnapshot(string $type, Model $entity): array
    {
        if ($type === 'cost_estimate' && $entity instanceof CostEstimate) {
            $entity->loadMissing('lines');
            return [
                'estimate_no'      => $entity->estimate_no,
                'rfq_id'           => $entity->rfq_id,
                'rfq_item_id'      => $entity->rfq_item_id,
                'customer_id'      => $entity->customer_id,
                'job_name'         => $entity->job_name,
                'part_no'          => $entity->part_no,
                'pricing_group'    => $entity->pricing_group,
                'overhead_pct'     => (float) $entity->overhead_pct,
                'vat_pct'          => (float) $entity->vat_pct,
                'times_multiplier' => (float) $entity->times_multiplier,
                'job_quantity'     => (int) $entity->job_quantity,
                'material_cost'    => (float) $entity->material_cost,
                'machining_cost'   => (float) $entity->machining_cost,
                'surface_cost'     => (float) $entity->surface_cost,
                'other_cost'       => (float) $entity->other_cost,
                'net_cost'         => (float) $entity->net_cost,
                'overhead_amount'  => (float) $entity->overhead_amount,
                'vat_amount'       => (float) $entity->vat_amount,
                'total'            => (float) $entity->total,
                'grand_total'      => (float) $entity->grand_total,
                'status'           => $entity->status,
                'approval_status'  => $entity->approval_status,
                'notes'            => $entity->notes,
                'line_count'       => $entity->lines->count(),
                'lines'            => $entity->lines->map(fn($l) => [
                    'section'     => $l->section,
                    'description' => $l->description,
                    'quantity'    => (float) $l->quantity,
                    'unit'        => $l->unit,
                    'rate'        => (float) $l->rate,
                    'amount'      => (float) $l->amount,
                    'material_id' => $l->material_id,
                    'operation_id'=> $l->operation_id,
                ])->values()->toArray(),
            ];
        }

        if ($type === 'quotation' && $entity instanceof Quotation) {
            return [
                'quotation_no'    => $entity->quotation_no ?? null,
                'rfq_id'          => $entity->rfq_id,
                'customer_id'     => $entity->customer_id,
                'material_cost'   => (float) $entity->material_cost,
                'labour_cost'     => (float) $entity->labour_cost,
                'overhead_cost'   => (float) $entity->overhead_cost,
                'profit_margin'   => (float) $entity->profit_margin,
                'discount'        => (float) $entity->discount,
                'vat_rate'        => (float) $entity->vat_rate,
                'subtotal'        => (float) ($entity->subtotal ?? 0),
                'total_amount'    => (float) $entity->total_amount,
                'status'          => $entity->status,
                'validity_days'   => $entity->validity_days,
                'notes'           => $entity->notes,
                'version'         => $entity->version,
            ];
        }

        // Fallback: full attributes
        return $entity->getAttributes();
    }

    /**
     * Compute field-level diff between two snapshots.
     * Returns ['field' => ['old' => x, 'new' => y], ...]
     */
    private function computeDiff(array $before, array $after): array
    {
        $changes = [];
        $skipFields = ['lines', 'line_count']; // lines handled separately

        foreach ($after as $key => $newVal) {
            if (in_array($key, $skipFields)) continue;
            $oldVal = $before[$key] ?? null;
            if ($oldVal !== $newVal && (string) $oldVal !== (string) $newVal) {
                $changes[$key] = ['old' => $oldVal, 'new' => $newVal];
            }
        }

        // Track line count change
        $oldLines = $before['line_count'] ?? count($before['lines'] ?? []);
        $newLines = $after['line_count'] ?? count($after['lines'] ?? []);
        if ($oldLines !== $newLines) {
            $changes['_lines'] = ['old' => $oldLines, 'new' => $newLines];
        }

        return $changes;
    }

    /**
     * Build a human-readable summary of the diff.
     */
    private function summarizeDiff(array $changes, ?float $oldTotal, ?float $newTotal): ?string
    {
        if (empty($changes)) return null;

        $parts = [];

        // Total change — most important
        if ($oldTotal !== null && $newTotal !== null && abs($newTotal - $oldTotal) > 0.01) {
            $diff = $newTotal - $oldTotal;
            $pct = $oldTotal > 0 ? ($diff / $oldTotal) * 100 : 0;
            $arrow = $diff > 0 ? '↑' : '↓';
            $parts[] = "Total {$arrow} " . number_format(abs($diff), 0) . ' (' . ($diff > 0 ? '+' : '') . number_format($pct, 1) . '%)';
        }

        // Line count change
        if (isset($changes['_lines'])) {
            $delta = $changes['_lines']['new'] - $changes['_lines']['old'];
            if ($delta > 0) $parts[] = "+{$delta} line(s)";
            elseif ($delta < 0) $parts[] = ($delta) . " line(s) removed";
        }

        // Status/approval changes
        if (isset($changes['status'])) {
            $parts[] = "status: {$changes['status']['old']} → {$changes['status']['new']}";
        }
        if (isset($changes['approval_status'])) {
            $parts[] = "approval: " . str_replace('_', ' ', $changes['approval_status']['old'] ?? '') . ' → ' . str_replace('_', ' ', $changes['approval_status']['new'] ?? '');
        }

        // Significant field changes
        $notableFields = ['pricing_group', 'overhead_pct', 'vat_pct', 'job_quantity', 'profit_margin', 'discount'];
        foreach ($notableFields as $field) {
            if (isset($changes[$field])) {
                $label = str_replace('_', ' ', $field);
                $parts[] = "{$label}: {$changes[$field]['old']} → {$changes[$field]['new']}";
            }
        }

        return empty($parts) ? null : implode(' · ', array_slice($parts, 0, 4));
    }
}
