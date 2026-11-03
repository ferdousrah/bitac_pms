<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class RfqItem extends Model
{
    use HasCenter;

    protected $fillable = [
        'rfq_id', 'center_id', 'product_id', 'job_description', 'quantity', 'unit', 'notes',
        'reference_type', 'drawing_path', 'sample_received', 'sample_description', 'sample_photo_path',
    ];

    protected $casts = [
        'sample_received' => 'boolean',
    ];

    public function rfq()     { return $this->belongsTo(Rfq::class); }
    public function product() { return $this->belongsTo(Product::class); }

    /** Parts this job item is broken down into (numbered positionally). */
    public function parts()
    {
        return $this->hasMany(RfqItemPart::class)->orderBy('sort_order')->orderBy('id');
    }

    public function files()
    {
        return $this->hasMany(RfqItemFile::class)->orderBy('sort_order');
    }

    public function drawings()
    {
        return $this->hasMany(RfqItemFile::class)->where('type', 'drawing')->orderBy('sort_order');
    }

    public function samplePhotos()
    {
        return $this->hasMany(RfqItemFile::class)->where('type', 'sample_photo')->orderBy('sort_order');
    }

    public function costEstimates()
    {
        return $this->hasMany(CostEstimate::class)->latest();
    }

    /** Estimates raised against the item as a whole, i.e. not against a part. */
    public function itemLevelEstimates()
    {
        return $this->hasMany(CostEstimate::class)->whereNull('rfq_item_part_id')->latest();
    }

    /**
     * What this job costs — the single source of truth for every downstream
     * consumer (quotation, RFQ screen, reports).
     *
     * Costing is PART-WISE when the job has parts: each part carries its own
     * estimate, and a part's quantity is what ONE unit of the job takes (BITAC,
     * 2026-11-03: one steam coil = 28 pipes, 7 U-bends …). So the sum of the
     * part estimates is the price of one job unit (`unit`), and the job total
     * is that × the job quantity.
     *
     * A job with no parts — and every estimate raised before parts existed —
     * falls back to the old behaviour: the latest item-level estimate.
     *
     * Returns the breakdown as well as the total so callers can warn about
     * parts that have not been costed yet instead of quoting short.
     *
     *   mode: 'parts'  → unit is the sum of part estimates, total = unit × quantity
     *         'item'   → total came from a single item-level estimate
     *         'none'   → nothing costed yet
     */
    public function jobCostBreakdown(): array
    {
        $parts = $this->relationLoaded('parts') ? $this->parts : $this->parts()->get();

        $rows = $parts->values()->map(function ($part, $idx) use ($parts) {
            $estimate = $part->effectiveEstimate();
            return [
                'part'        => $part,
                'part_no'     => RfqItemPart::formatNo($idx, $parts->count()),
                'estimate'    => $estimate,
                'grand_total' => $estimate ? (float) $estimate->grand_total : null,
            ];
        });

        $costed = $rows->whereNotNull('estimate');

        // Parts exist and at least one is costed → part-wise costing.
        if ($costed->isNotEmpty()) {
            $unit = round((float) $costed->sum('grand_total'), 2);
            return [
                'mode'       => 'parts',
                'unit'       => $unit,
                'quantity'   => $this->jobQuantity(),
                'total'      => round($unit * $this->jobQuantity(), 2),
                'parts'      => $rows->all(),
                'part_count' => $rows->count(),
                'costed'     => $costed->count(),
                'missing'    => $rows->count() - $costed->count(),
                'estimate'   => null,
            ];
        }

        // No part estimates — fall back to an item-level estimate. This covers
        // jobs without parts AND jobs whose parts have not been costed yet but
        // which already carry a whole-job estimate from before.
        $itemEstimates = $this->itemLevelEstimates()->get();
        $estimate = $itemEstimates->firstWhere('status', '!=', 'draft') ?? $itemEstimates->first();

        // A whole-job estimate already covers the full quantity.
        $total = $estimate ? round((float) $estimate->grand_total, 2) : 0.0;

        return [
            'mode'       => $estimate ? 'item' : 'none',
            'unit'       => round($total / $this->jobQuantity(), 2),
            'quantity'   => $this->jobQuantity(),
            'total'      => $total,
            'parts'      => $rows->all(),
            'part_count' => $rows->count(),
            'costed'     => 0,
            'missing'    => $rows->count(),
            'estimate'   => $estimate,
        ];
    }

    /** The job quantity, never below 1 — a blank quantity costs one unit. */
    public function jobQuantity(): float
    {
        return max(1.0, (float) $this->quantity);
    }

    /** Convenience: just the money. */
    public function jobCostTotal(): float
    {
        return (float) $this->jobCostBreakdown()['total'];
    }
}
