<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * One part within an RFQ job item.
 *
 * Only the name is stored. The part number is positional and derived at
 * render time (`formatNo`) so removing a part re-numbers the rest instead
 * of leaving a gap — the same `n/total` convention work order items use.
 */
class RfqItemPart extends Model
{
    use HasCenter;

    protected $fillable = ['rfq_item_id', 'center_id', 'name', 'quantity', 'unit', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:2'];
    }

    public function rfqItem() { return $this->belongsTo(RfqItem::class); }

    /** Cost estimates raised against this part (newest first). */
    public function costEstimates()
    {
        return $this->hasMany(CostEstimate::class)->latest('id');
    }

    /**
     * The estimate that counts for this part: the newest one that has left
     * draft, falling back to the newest draft so a work-in-progress still
     * shows up in the job roll-up.
     */
    public function effectiveEstimate(): ?CostEstimate
    {
        $all = $this->relationLoaded('costEstimates')
            ? $this->costEstimates
            : $this->costEstimates()->get();

        return $all->firstWhere('status', '!=', 'draft') ?? $all->first();
    }

    /** Positional part number, e.g. formatNo(0, 3) === '1/3'. */
    public static function formatNo(int $index, int $total): string
    {
        return ($index + 1) . '/' . max($total, 1);
    }
}
