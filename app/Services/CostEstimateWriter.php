<?php

namespace App\Services;

use App\Models\CostEstimate;
use Illuminate\Support\Facades\DB;

/**
 * The single place a cost estimate is written.
 *
 * Both the one-estimate form and the Job Costing editor (which saves every
 * part of a job at once) go through here, so validation, line storage,
 * recalculation and the approval-reset rule can never drift apart.
 *
 * Approval rule: an estimate that is pending or approved CAN be edited, but
 * if the edit actually changes it, its approval is wiped and it returns to
 * draft — an approval only ever vouches for the figures it was given. Saving
 * with nothing changed leaves it untouched.
 */
class CostEstimateWriter
{
    /** Validation rules for one estimate (unprefixed). */
    public static function rules(): array
    {
        return [
            'rfq_id'           => 'nullable|exists:rfqs,id',
            'rfq_item_id'      => 'nullable|exists:rfq_items,id',
            // Set when this estimate covers ONE part of the job rather than
            // the whole job. Null = whole-job estimate (the old behaviour).
            'rfq_item_part_id' => 'nullable|exists:rfq_item_parts,id',
            'customer_id'      => 'nullable|exists:customers,id',
            'company_name'     => 'nullable|string|max:200',
            'job_name'         => 'required|string|max:200',
            'part_no'          => 'nullable|string|max:50',
            'actual_size'      => 'nullable|string|max:100',
            'materials_size'   => 'nullable|string|max:100',
            'pricing_group'    => 'required|in:A,B,C,STUDENT,PUBLIC',
            'overhead_pct'     => 'nullable|numeric|min:0|max:1000',
            'extra_cost'       => 'nullable|numeric|min:0',
            'vat_pct'          => 'nullable|numeric|min:0|max:100',
            'tax_pct'          => 'nullable|numeric|min:0|max:100',
            'times_multiplier' => 'nullable|numeric|min:0|max:100',
            'job_quantity'     => 'nullable|integer|min:1',
            // Manual rounding override (e.g. ৳250,500 → ৳250,000). Null/0 = use auto.
            'grand_total_override' => 'nullable|numeric|min:0',
            'notes'            => 'nullable|string|max:1000',
            'lines'                 => 'nullable|array',
            'lines.*.section'       => 'required|in:material,machining,surface,other',
            'lines.*.material_id'   => 'nullable|exists:materials,id',
            'lines.*.operation_id'  => 'nullable|exists:machining_operations,id',
            'lines.*.description'   => 'nullable|string|max:255',
            'lines.*.quantity'      => 'nullable|numeric|min:0',
            'lines.*.unit'          => 'nullable|string|max:20',
            'lines.*.rate'          => 'nullable|numeric|min:0',
        ];
    }

    public function create(array $validated): CostEstimate
    {
        return DB::transaction(function () use ($validated) {
            // If rfq_item_id given, auto-populate rfq_id + job_category_id from the parent RFQ
            $rfqId = $validated['rfq_id'] ?? null;
            $jobCategoryId = null;
            // A part estimate inherits its job item (and therefore its RFQ)
            // from the part, so the caller only has to pass the part.
            if (!empty($validated['rfq_item_part_id'])) {
                $part = \App\Models\RfqItemPart::with('rfqItem.rfq')->find($validated['rfq_item_part_id']);
                if ($part) {
                    $validated['rfq_item_id'] = $part->rfq_item_id;
                }
            }
            if (!empty($validated['rfq_item_id'])) {
                $item = \App\Models\RfqItem::with('rfq')->find($validated['rfq_item_id']);
                if ($item) {
                    $rfqId = $item->rfq_id;
                    $jobCategoryId = $item->rfq?->job_category_id;
                }
            } elseif ($rfqId) {
                $jobCategoryId = \App\Models\Rfq::find($rfqId)?->job_category_id;
            }

            $estimate = $this->createWithRetry([
                'rfq_id'           => $rfqId,
                'rfq_item_id'      => $validated['rfq_item_id'] ?? null,
                'rfq_item_part_id' => $validated['rfq_item_part_id'] ?? null,
                'job_category_id'  => $jobCategoryId,
                'status'           => 'draft',
                'created_by'       => auth()->id(),
            ] + $this->attributes($validated));

            $this->saveLines($estimate, $validated['lines'] ?? []);
            $estimate->recalculate();

            app(RevisionTracker::class)->trackEstimate($estimate->fresh(), 'created');

            return $estimate;
        });
    }

    /**
     * Apply an edit. Returns false when the submitted data is identical to
     * what is stored — nothing is written and the approval is left alone.
     */
    public function update(CostEstimate $estimate, array $validated, ?string $changeReason = null): bool
    {
        $estimate->loadMissing('lines');

        if ($this->fingerprint($estimate) === $this->fingerprintOf($validated)) {
            return false;
        }

        $wasDecided = in_array($estimate->approval_status, ['pending_approval', 'approved'], true);

        DB::transaction(function () use ($estimate, $validated, $wasDecided) {
            $estimate->update($this->attributes($validated));

            $estimate->lines()->delete();
            $this->saveLines($estimate, $validated['lines'] ?? []);
            $estimate->recalculate();

            // The approval vouched for the old figures, not these.
            if ($wasDecided) {
                $estimate->approvals()->delete();
                $estimate->update([
                    'approval_status' => 'not_submitted',
                    'approval_batch'  => null,
                    'status'          => 'draft',
                ]);
            }
        });

        // Track revision — if it was previously sent back, treat as resubmission
        $wasRejectedOrChanges = \App\Models\EntityRevision::where('entity_type', 'cost_estimate')
            ->where('entity_id', $estimate->id)
            ->whereIn('event', ['rejected', 'changes_requested'])
            ->exists();

        app(RevisionTracker::class)->trackEstimate(
            $estimate->fresh(),
            $wasRejectedOrChanges ? 'resubmitted' : 'updated',
            $wasDecided ? trim(($changeReason ? $changeReason . ' — ' : '') . 'approval reset by edit') : $changeReason,
        );

        return true;
    }

    /** Whether saving this estimate would wipe an approval. */
    public static function editResetsApproval(CostEstimate $estimate): bool
    {
        return in_array($estimate->approval_status, ['pending_approval', 'approved'], true);
    }

    private function attributes(array $v): array
    {
        return [
            'customer_id'      => $v['customer_id'] ?? null,
            'company_name'     => $v['company_name'] ?? null,
            'job_name'         => $v['job_name'],
            'part_no'          => $v['part_no'] ?? null,
            'actual_size'      => $v['actual_size'] ?? null,
            'materials_size'   => $v['materials_size'] ?? null,
            'pricing_group'    => $v['pricing_group'],
            'overhead_pct'     => $v['overhead_pct'] ?? 0,
            'extra_cost'       => $v['extra_cost'] ?? 0,
            'vat_pct'          => $v['vat_pct'] ?? 15,
            'tax_pct'          => $v['tax_pct'] ?? 0,
            'times_multiplier' => $v['times_multiplier'] ?? 1,
            'job_quantity'     => $v['job_quantity'] ?? 1,
            'grand_total_override' => $this->normalizeOverride($v['grand_total_override'] ?? null),
            'notes'            => $v['notes'] ?? null,
        ];
    }

    /** A comparable snapshot of what is stored. */
    private function fingerprint(CostEstimate $e): string
    {
        return $this->canonical([
            'customer_id' => $e->customer_id, 'company_name' => $e->company_name, 'job_name' => $e->job_name,
            'part_no' => $e->part_no, 'actual_size' => $e->actual_size, 'materials_size' => $e->materials_size,
            'pricing_group' => $e->pricing_group, 'overhead_pct' => $e->overhead_pct, 'extra_cost' => $e->extra_cost,
            'vat_pct' => $e->vat_pct, 'tax_pct' => $e->tax_pct, 'times_multiplier' => $e->times_multiplier,
            'job_quantity' => $e->job_quantity, 'grand_total_override' => $e->grand_total_override, 'notes' => $e->notes,
        ], $e->lines->sortBy('sequence')->map(fn ($l) => $l->only([
            'section', 'material_id', 'operation_id', 'description', 'quantity', 'unit', 'rate',
        ]))->values()->all());
    }

    /** The same snapshot built from submitted data. */
    private function fingerprintOf(array $v): string
    {
        $attrs = $this->attributes($v);
        $lines = collect($v['lines'] ?? [])
            ->reject(fn ($l) => empty($l['description']) && empty($l['material_id']) && empty($l['operation_id']))
            ->map(fn ($l) => [
                'section' => $l['section'], 'material_id' => $l['material_id'] ?? null,
                'operation_id' => $l['operation_id'] ?? null, 'description' => $l['description'] ?? '',
                'quantity' => $l['quantity'] ?? 0, 'unit' => $l['unit'] ?? 'pcs', 'rate' => $l['rate'] ?? 0,
            ])->values()->all();

        return $this->canonical($attrs, $lines);
    }

    /** Normalise types so "25", 25 and "25.00" compare equal. */
    private function canonical(array $attrs, array $lines): string
    {
        $norm = function ($v) {
            if ($v === null || $v === '') return null;
            if (is_numeric($v)) return round((float) $v, 4);
            return trim((string) $v);
        };
        $attrs = array_map($norm, $attrs);
        $lines = array_map(fn ($l) => array_map($norm, $l), $lines);

        return json_encode([$attrs, $lines]);
    }

    private function normalizeOverride($value): ?float
    {
        if ($value === null || $value === '' || $value === false) return null;
        $f = (float) $value;
        return $f > 0 ? $f : null;
    }

    /**
     * Two concurrent submits can both compute the same estimate_no before
     * either commits, so on a unique violation regenerate and retry.
     */
    private function createWithRetry(array $payload): CostEstimate
    {
        $attempts = 0;
        while (true) {
            try {
                $payload['estimate_no'] = CostEstimate::generateEstimateNo();
                return CostEstimate::create($payload);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                if (++$attempts >= 5 || !str_contains((string) $e->getMessage(), 'estimate_no')) {
                    throw $e;
                }
                usleep(50_000);
            }
        }
    }

    private function saveLines(CostEstimate $estimate, array $lines): void
    {
        foreach (array_values($lines) as $idx => $line) {
            if (empty($line['description']) && empty($line['material_id']) && empty($line['operation_id'])) {
                continue;
            }
            $estimate->lines()->create([
                'section'      => $line['section'],
                'material_id'  => $line['material_id'] ?? null,
                'operation_id' => $line['operation_id'] ?? null,
                'description'  => $line['description'] ?? '',
                'quantity'     => (float) ($line['quantity'] ?? 0),
                'unit'         => $line['unit'] ?? 'pcs',
                'rate'         => (float) ($line['rate'] ?? 0),
                'amount'       => (float) ($line['quantity'] ?? 0) * (float) ($line['rate'] ?? 0),
                'sequence'     => $idx,
            ]);
        }
    }
}
