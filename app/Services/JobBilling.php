<?php

namespace App\Services;

use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\WorkOrder;
use App\Support\DocNumber;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * How a job is billed (BITAC, 2026-11-02: *"Partial eo bill need hoy, Full eo,
 * abr Advance bill o hoy"*). Three kinds of bill, one ledger:
 *
 *  - ADVANCE  — before anything is delivered, an amount against the job.
 *  - PARTIAL / FULL — a DELIVERY bill for one or more delivered challans of the
 *    job not billed yet, each line at the quotation's unit price (VAT incl.).
 *    "Full" is simply a bill that takes every challan.
 *
 * A delivery bill recovers the job's advance bills from its goods value until
 * they are used up (`advance_adjusted`), so the job's bills always add up to
 * what was delivered, and never past the quotation.
 *
 *   job goods billed  = Σ goods value of its delivery bills
 *   advance in hand   = Σ advance bills − Σ advance adjusted
 *   bill total        = goods value − advance adjusted
 */
class JobBilling
{
    /** VAT-inclusive quotation total — the most the job can be billed. */
    public static function quotationTotal(WorkOrder $wo): float
    {
        return (float) ($wo->quotation?->total_amount ?? 0);
    }

    /** work_order_item id => VAT-inclusive unit price; 0 => the job's average per piece. */
    public static function unitPrices(WorkOrder $wo): array
    {
        $wo->loadMissing('items', 'quotation.items');
        $avg = (float) $wo->quantity > 0 ? self::quotationTotal($wo) / (float) $wo->quantity : 0.0;
        $quoted = $wo->quotation?->items?->keyBy('id') ?? collect();

        $prices = [0 => $avg];
        foreach ($wo->items as $i) {
            $q = $i->quotation_item_id ? $quoted->get($i->quotation_item_id) : null;
            $prices[$i->id] = $q ? (float) $q->unit_price : $avg;
        }

        return $prices;
    }

    /** The lines a delivered challan puts on a bill: description, qty, unit price, amount. */
    public static function deliveryLines(DeliveryOrder $d, array $prices): Collection
    {
        $d->loadMissing('items', 'workOrder.product');
        $rows = $d->items->isNotEmpty()
            ? $d->items->map(fn ($l) => [
                'work_order_item_id' => $l->work_order_item_id,
                'description'        => $l->description,
                'part_no'            => $l->part_no,
                'unit'               => $l->unit ?: 'pcs',
                'quantity'           => (float) $l->quantity,
                'unit_price'         => (float) ($prices[$l->work_order_item_id ?? 0] ?? $prices[0]),
            ])
            // A challan from before delivery lines carries only its total.
            : collect([[
                'work_order_item_id' => null,
                'description'        => $d->workOrder?->product?->name ?: $d->workOrder?->wo_number,
                'part_no'            => null,
                'unit'               => 'pcs',
                'quantity'           => (float) $d->quantity_delivered,
                'unit_price'         => (float) $prices[0],
            ]]);

        return $rows->filter(fn ($r) => $r['quantity'] > 0)
            ->map(fn ($r) => $r + ['delivery_order_id' => $d->id, 'challan_number' => $d->challan_number,
                'amount' => round($r['quantity'] * $r['unit_price'], 2)])
            ->values();
    }

    /** Figures for the job as it stands. */
    public static function standing(WorkOrder $wo): array
    {
        $bills = Invoice::withoutGlobalScopes()->where('work_order_id', $wo->id)->get();
        $advance  = (float) $bills->where('kind', 'advance')->sum('total_amount');
        $adjusted = (float) $bills->where('kind', '!=', 'advance')->sum('advance_adjusted');
        $goods    = (float) $bills->where('kind', '!=', 'advance')->sum(fn ($b) => $b->goodsValue());
        $quoted   = self::quotationTotal($wo);

        return [
            'quotation_total'   => round($quoted, 2),
            'goods_billed'      => round($goods, 2),
            'advance_billed'    => round($advance, 2),
            'advance_in_hand'   => round(max(0, $advance - $adjusted), 2),
            'billed_total'      => round((float) $bills->sum('total_amount'), 2),
            // What an advance bill may still ask for: nothing billed beyond the quotation.
            'advance_room'      => round(max(0, $quoted - $goods - max(0, $advance - $adjusted)), 2),
        ];
    }

    /** Delivered, signed challans of the job that are on no bill yet. */
    public static function unbilled(WorkOrder $wo): Collection
    {
        return DeliveryOrder::withoutGlobalScopes()->where('work_order_id', $wo->id)
            ->where('status', 'delivered')->whereNull('invoice_id')->whereNotNull('challan_number')
            ->challanSigned()
            ->with('items')->orderBy('delivered_at')->orderBy('id')->get();
    }

    /**
     * What a delivery bill for these challans comes to — the page's preview and
     * the save read the same numbers.
     *
     * @param  Collection<DeliveryOrder>  $deliveries
     */
    public static function preview(WorkOrder $wo, Collection $deliveries): array
    {
        $prices = self::unitPrices($wo);
        $lines  = $deliveries->flatMap(fn ($d) => self::deliveryLines($d, $prices))->values();
        $goods  = round((float) $lines->sum('amount'), 2);
        $s      = self::standing($wo);

        // The last bill of a fully delivered job takes the quotation's remainder
        // exactly, so paisa rounding cannot leave the job a few paisa short or over.
        $everything = $wo->status === 'delivered'
            && self::unbilled($wo)->pluck('id')->diff($deliveries->pluck('id'))->isEmpty();
        $remainder = round($s['quotation_total'] - $s['goods_billed'], 2);
        if ($everything && $lines->isNotEmpty() && abs($remainder - $goods) > 0 && abs($remainder - $goods) < 1) {
            $last = $lines->count() - 1;
            $lines[$last] = ['amount' => round($lines[$last]['amount'] + $remainder - $goods, 2)] + $lines[$last];
            $goods = $remainder;
        }

        $adjust = round(min($goods, $s['advance_in_hand']), 2);

        return [
            'lines'            => $lines,
            'goods_value'      => $goods,
            'advance_adjusted' => $adjust,
            'total'            => round($goods - $adjust, 2),
            'standing'         => $s,
            // Past the quotation: older bills that took the whole quotation per delivery.
            'over_quotation'   => $s['quotation_total'] > 0 && $s['goods_billed'] + $goods > $s['quotation_total'] + 1,
        ];
    }

    /** subtotal / VAT / tax of an amount, in the quotation's proportions (VAT and tax embedded). */
    public static function taxSplit(WorkOrder $wo, float $amount): array
    {
        $q = $wo->quotation;
        $vatRate = $q?->vat_rate !== null ? (float) $q->vat_rate : (float) config('app.vat_rate', 15);
        $taxRate = (float) ($q?->tax_rate ?? 0);
        $quoted  = self::quotationTotal($wo);
        $tax     = $quoted > 0 ? (float) ($q?->tax_amount ?? 0) * $amount / $quoted : 0.0;
        $vat     = ($amount - $tax) * $vatRate / (100 + $vatRate);

        return [
            'subtotal'   => round($amount - $tax - $vat, 2),
            'vat_rate'   => round($vatRate, 2),
            'vat_amount' => round($vat, 2),
            'tax_rate'   => round($taxRate, 2),
            'tax_amount' => round($tax, 2),
        ];
    }

    /** Raise one delivery bill for the given challans (already checked to be the job's, unbilled). */
    public static function raiseDeliveryBill(WorkOrder $wo, Collection $deliveries): Invoice
    {
        return DB::transaction(function () use ($wo, $deliveries) {
            $p = self::preview($wo, $deliveries);

            $invoice = Invoice::create([
                'invoice_number'    => DocNumber::next('invoices', 'invoice_number', 'INV', $wo->center_id),
                'kind'              => 'delivery',
                'center_id'         => $wo->center_id,
                'work_order_id'     => $wo->id,
                'delivery_order_id' => $deliveries->last()->id,
                'customer_id'       => $wo->customer_id,
                'goods_value'       => $p['goods_value'],
                'advance_adjusted'  => $p['advance_adjusted'],
                'total_amount'      => $p['total'],
                'discount'          => 0,
                'status'            => 'issued',
                'issued_at'         => now(),
            ] + self::taxSplit($wo, $p['total']));

            foreach ($p['lines'] as $n => $l) {
                $invoice->items()->create([
                    'delivery_order_id'  => $l['delivery_order_id'],
                    'work_order_item_id' => $l['work_order_item_id'],
                    'description'        => $l['description'],
                    'part_no'            => $l['part_no'],
                    'unit'               => $l['unit'],
                    'quantity'           => $l['quantity'],
                    'unit_price'         => $l['unit_price'],
                    'amount'             => $l['amount'],
                    'sort_order'         => $n,
                ]);
            }
            DeliveryOrder::withoutGlobalScopes()->whereIn('id', $deliveries->pluck('id'))->update(['invoice_id' => $invoice->id]);

            // A bill wholly covered by the advance asks for nothing.
            if ($p['total'] <= PaymentLedger::TOLERANCE) {
                $invoice->forceFill(['status' => 'paid', 'paid_at' => now()])->save();
            }

            return $invoice;
        });
    }

    /** An advance bill against the job, before (or between) deliveries. */
    public static function raiseAdvanceBill(WorkOrder $wo, float $amount, ?string $note = null): Invoice
    {
        return DB::transaction(function () use ($wo, $amount, $note) {
            $amount  = round($amount, 2);
            $invoice = Invoice::create([
                'invoice_number' => DocNumber::next('invoices', 'invoice_number', 'INV', $wo->center_id),
                'kind'           => 'advance',
                'center_id'      => $wo->center_id,
                'work_order_id'  => $wo->id,
                'customer_id'    => $wo->customer_id,
                'total_amount'   => $amount,
                'discount'       => 0,
                'status'         => 'issued',
                'issued_at'      => now(),
            ] + self::taxSplit($wo, $amount));

            $quoted = self::quotationTotal($wo);
            $invoice->items()->create([
                'description' => trim('Advance against Job ' . ($wo->job_number ?? $wo->wo_number)
                    . ($quoted > 0 ? ' — ' . rtrim(rtrim(number_format($amount * 100 / $quoted, 2, '.', ''), '0'), '.') . '% of the quotation' : '')
                    . ($note ? ". {$note}" : '')),
                'unit'        => 'lot',
                'quantity'    => 1,
                'unit_price'  => $amount,
                'amount'      => $amount,
            ]);

            return $invoice;
        });
    }
}
