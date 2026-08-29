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

    protected $fillable = ['rfq_item_id', 'center_id', 'name', 'sort_order'];

    public function rfqItem() { return $this->belongsTo(RfqItem::class); }

    /** Positional part number, e.g. formatNo(0, 3) === '1/3'. */
    public static function formatNo(int $index, int $total): string
    {
        return ($index + 1) . '/' . max($total, 1);
    }
}
