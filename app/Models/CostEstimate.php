<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class CostEstimate extends Model
{
    use HasCenter;

    protected $fillable = [
        'estimate_no', 'rfq_id', 'rfq_item_id', 'center_id', 'quotation_id', 'customer_id',
        'company_name', 'job_name', 'part_no', 'actual_size', 'materials_size',
        'pricing_group', 'overhead_pct', 'vat_pct', 'times_multiplier', 'job_quantity',
        'material_cost', 'machining_cost', 'surface_cost', 'other_cost',
        'net_cost', 'overhead_amount', 'vat_amount', 'total', 'grand_total',
        'status', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'overhead_pct'      => 'decimal:2',
            'vat_pct'           => 'decimal:2',
            'times_multiplier'  => 'decimal:2',
            'material_cost'     => 'decimal:2',
            'machining_cost'    => 'decimal:2',
            'surface_cost'      => 'decimal:2',
            'other_cost'        => 'decimal:2',
            'net_cost'          => 'decimal:2',
            'overhead_amount'   => 'decimal:2',
            'vat_amount'        => 'decimal:2',
            'total'             => 'decimal:2',
            'grand_total'       => 'decimal:2',
        ];
    }

    public function rfq()       { return $this->belongsTo(Rfq::class); }
    public function rfqItem()   { return $this->belongsTo(RfqItem::class); }
    public function quotation() { return $this->belongsTo(Quotation::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
    public function lines()     { return $this->hasMany(CostEstimateLine::class)->orderBy('section')->orderBy('sequence'); }

    public function approvals()      { return $this->hasMany(CostEstimateApproval::class)->orderBy('level'); }

    public function materialLines()  { return $this->lines()->where('section', 'material'); }
    public function machiningLines() { return $this->lines()->where('section', 'machining'); }
    public function surfaceLines()   { return $this->lines()->where('section', 'surface'); }
    public function otherLines()     { return $this->lines()->where('section', 'other'); }

    /**
     * Recalculate all totals from line items.
     */
    public function recalculate(): self
    {
        $material  = (float) $this->lines()->where('section', 'material')->sum('amount');
        $machining = (float) $this->lines()->where('section', 'machining')->sum('amount');
        $surface   = (float) $this->lines()->where('section', 'surface')->sum('amount');
        $other     = (float) $this->lines()->where('section', 'other')->sum('amount');

        $netCost   = $material + $machining + $surface + $other;
        $overhead  = $netCost * ((float) $this->overhead_pct / 100);
        $afterOH   = $netCost + $overhead;
        $vat       = $afterOH * ((float) $this->vat_pct / 100);
        $total     = $afterOH + $vat;
        $withTimes = $total * (float) $this->times_multiplier;
        $grand     = $withTimes * (int) $this->job_quantity;

        $this->fill([
            'material_cost'   => round($material, 2),
            'machining_cost'  => round($machining, 2),
            'surface_cost'    => round($surface, 2),
            'other_cost'      => round($other, 2),
            'net_cost'        => round($netCost, 2),
            'overhead_amount' => round($overhead, 2),
            'vat_amount'      => round($vat, 2),
            'total'           => round($withTimes, 2),
            'grand_total'     => round($grand, 2),
        ])->save();

        return $this;
    }

    public static function generateEstimateNo(): string
    {
        $year = now()->format('Y');
        $last = static::where('estimate_no', 'like', "EST-{$year}-%")->max('estimate_no');
        $next = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('EST-%s-%04d', $year, $next);
    }
}
