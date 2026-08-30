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
     * estimate and the job total is the plain SUM of them. Part quantities
     * are absolute (total pieces for the order), so the sum is NOT multiplied
     * by the job quantity again.
     *
     * A job with no parts — and every estimate raised before parts existed —
     * falls back to the old behaviour: the latest item-level estimate.
     *
     * Returns the breakdown as well as the total so callers can warn about
     * parts that have not been costed yet instead of quoting short.
     *
     *   mode: 'parts'  → total is the sum of part estimates
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
            return [
                'mode'       => 'parts',
                'total'      => round((float) $costed->sum('grand_total'), 2),
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

        return [
            'mode'       => $estimate ? 'item' : 'none',
            'total'      => $estimate ? round((float) $estimate->grand_total, 2) : 0.0,
            'parts'      => $rows->all(),
            'part_count' => $rows->count(),
            'costed'     => 0,
            'missing'    => $rows->count(),
            'estimate'   => $estimate,
        ];
    }

    /** Convenience: just the money. */
    public function jobCostTotal(): float
    {
        return (float) $this->jobCostBreakdown()['total'];
    }
}
