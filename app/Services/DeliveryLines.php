<?php

namespace App\Services;

use App\Models\DeliveryOrder;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Per job item: how much was ordered, how much is already on a delivery, and
 * how much is left — the one answer the delivery form, its save and the
 * partial challan all read (BITAC, 2026-10-24).
 *
 * Each line: key (the work_order_item id, or 0 for a job with no item rows),
 * work_order_item_id, description, part_no, unit, ordered, earlier, remaining.
 *
 * ⚠️ Deliveries made before delivery lines existed carry only a total. On a
 * single-line job that total is that line's; on a multi-line job it cannot be
 * split, so it is left unallocated — the job-wide QC cap (deliverableQty)
 * still stops more going out than passed QC.
 */
class DeliveryLines
{
    /**
     * @param int|null $beforeDeliveryId count only deliveries raised before this one
     *                                   (what a challan calls "delivered earlier")
     */
    public static function forWorkOrder(WorkOrder $wo, ?int $beforeDeliveryId = null): Collection
    {
        $wo->loadMissing('items.product', 'product');

        $committed = fn () => DeliveryOrder::withoutGlobalScopes()
            ->where('work_order_id', $wo->id)
            ->whereIn('status', DeliveryOrder::COMMITTED)
            ->when($beforeDeliveryId, fn ($q) => $q->where('id', '<', $beforeDeliveryId));

        $byItem = DB::table('delivery_order_items')
            ->whereIn('delivery_order_id', $committed()->select('id'))
            ->selectRaw('COALESCE(work_order_item_id, 0) as k, SUM(quantity) as q')
            ->groupBy('k')->pluck('q', 'k');

        // Totals from deliveries that have no lines (made before lines existed).
        $legacy = (float) $committed()->whereDoesntHave('items')->sum('quantity_delivered');

        $items = $wo->items->sortBy('display_order')->values();
        $lines = $items->isNotEmpty()
            ? $items->map(fn ($i, $n) => [
                'key'                => (int) $i->id,
                'work_order_item_id' => (int) $i->id,
                'description'        => $i->description ?: $i->product?->name ?: 'Item ' . ($n + 1),
                'part_no'            => $i->part_no ?: ($items->count() > 1 ? ($n + 1) . '/' . $items->count() : null),
                'unit'               => $i->unit ?: 'pcs',
                'ordered'            => (float) $i->quantity,
            ])
            : collect([[
                'key'                => 0,
                'work_order_item_id' => null,
                'description'        => $wo->product?->name ?: $wo->wo_number,
                'part_no'            => null,
                'unit'               => 'pcs',
                'ordered'            => (float) $wo->quantity,
            ]]);

        $single = $lines->count() === 1;

        return $lines->map(function ($l) use ($byItem, $legacy, $single) {
            $earlier = (float) ($byItem[$l['key']] ?? 0) + ($single ? $legacy : 0);

            return $l + [
                'earlier'   => round($earlier, 2),
                'remaining' => round(max(0, $l['ordered'] - $earlier), 2),
            ];
        })->values();
    }
}
