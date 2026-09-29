<?php

namespace App\Services;

use App\Models\Center;
use App\Models\Invoice;
use App\Models\MusakChallan;

/**
 * Building a মূসক ৬.৩ — the line arithmetic, and raising one from a bill.
 *
 * ⚠️ **The bill and the challan are ONE act.** BITAC issues them together, so
 * `InvoiceService::createFromDelivery()` calls `createFromInvoice()` straight
 * after writing the invoice. Nobody should have to remember to raise the tax
 * challan separately.
 */
class MusakChallanService
{
    /**
     * One line's figures, exactly as they will print.
     *
     * ⚠️ **Money on মূসক ৬.৩ is WHOLE TAKA.** The original BITAC challan reads
     * 290,909 + 10% = 29,091 → 320,000: the VAT is rounded to the taka, and
     * that is what makes the columns add up on the printed form. Rounding here
     * rather than at print time is what keeps the stored figures and the paper
     * identical, and keeps সর্বমোট equal to the sum of the column.
     *
     * Only the **unit price** (col ৫) keeps its paisa — rounding that would
     * move the price of every piece, which is a different thing from rounding
     * a total. `1000 × ৳12.50` must stay ৳12,500, not ৳13,000.
     *
     * সম্পূরক শুল্ক is part of the taxable base, so VAT sits on value + SD.
     */
    public static function computeLine(float $qty, float $unitPrice, float $sdRate, float $vatRate): array
    {
        $value = round($qty * $unitPrice);
        $sd    = round($value * $sdRate / 100);
        $vat   = round(($value + $sd) * $vatRate / 100);

        return [
            'total_value'     => $value,
            'sd_amount'       => $sd,
            'vat_amount'      => $vat,
            'total_inclusive' => $value + $sd + $vat,
        ];
    }

    /**
     * Raise the challan that goes out with a bill.
     *
     * Returns null when there is nothing to put on it — a bill with no
     * quotation behind it has no lines, and a blank tax challan is worse than
     * no tax challan. Returns the existing one rather than a second if the
     * invoice already has one.
     */
    public function createFromInvoice(Invoice $invoice, ?int $signatoryUserId = null): ?MusakChallan
    {
        if ($existing = $invoice->musakChallans()->first()) {
            return $existing;
        }

        $invoice->loadMissing(['customer', 'workOrder.quotation.items', 'workOrder.items', 'deliveryOrder']);

        $lines = $this->linesFor($invoice);
        if ($lines->isEmpty()) {
            return null;
        }

        $centre = Center::find($invoice->center_id ?? 1);

        $challan = MusakChallan::create([
            'center_id'         => $invoice->center_id,
            'invoice_id'        => $invoice->id,
            'delivery_order_id' => $invoice->delivery_order_id,
            'work_order_id'     => $invoice->work_order_id,
            'customer_id'       => $invoice->customer_id,
            'challan_no'        => MusakChallan::generateChallanNo($invoice->center_id),
            'issue_date'        => now()->toDateString(),
            'issue_time'        => now()->format('H:i'),
            'supplier_name'     => $centre?->name_bn ?: $centre?->name,
            'supplier_bin'      => $centre?->bin_number,
            'supplier_address'  => $centre?->address_bn ?: $centre?->address,
            'buyer_name'        => $invoice->customer?->name,
            'buyer_bin'         => $invoice->customer?->bin_number,
            'buyer_address'     => $invoice->customer?->address,
            'destination'       => $invoice->deliveryOrder?->delivery_address ?: $invoice->customer?->address,
            'vehicle'           => $invoice->deliveryOrder?->vehicle_number,
            // The officer who confirmed the delivery signs it. Their default
            // signature block is resolved at render, like every other document.
            'signatory_user_id' => $signatoryUserId ?? auth()->id(),
            'status'            => 'issued',
            'issued_at'         => now(),
            'created_by'        => auth()->id(),
        ]);

        $totals = ['value' => 0.0, 'sd' => 0.0, 'vat' => 0.0, 'incl' => 0.0];

        foreach ($lines as $i => $line) {
            $figures = self::computeLine(
                (float) $line['quantity'],
                (float) $line['unit_price'],
                0.0,
                (float) $line['vat_rate'],
            );

            $challan->items()->create([
                'sort_order' => $i,
                'description' => $line['description'],
                'unit'        => $line['unit'],
                'quantity'    => $line['quantity'],
                'unit_price'  => $line['unit_price'],
                'sd_rate'     => 0,
                'vat_rate'    => $line['vat_rate'],
                ...$figures,
            ]);

            $totals['value'] += $figures['total_value'];
            $totals['sd']    += $figures['sd_amount'];
            $totals['vat']   += $figures['vat_amount'];
            $totals['incl']  += $figures['total_inclusive'];
        }

        $challan->update([
            'total_value'     => $totals['value'],
            'total_sd'        => $totals['sd'],
            'total_vat'       => $totals['vat'],
            'total_inclusive' => $totals['incl'],
        ]);

        return $challan->fresh('items');
    }

    /**
     * The invoice's lines, priced for the challan.
     *
     * Quotation unit prices carry VAT **and** Tax, so the ex-tax price is
     * `gross / (1 + (vat+tax)/100)` — the same extraction the quotation itself
     * uses. That drops the AIT, which is correct: **the buyer deducts income
     * tax at source** (confirmed by BITAC, 2026-09-29), so it never belongs on
     * the supplier's challan, and মূসক ৬.৩ has no column for it.
     */
    public function linesFor(Invoice $invoice): \Illuminate\Support\Collection
    {
        $vatRate = (float) ($invoice->vat_rate ?? 0);
        $taxRate = (float) ($invoice->tax_rate ?? 0);
        $divisor = 1 + ($vatRate + $taxRate) / 100;

        $units = $invoice->workOrder?->items->pluck('unit')->values() ?? collect();

        return collect($invoice->workOrder?->quotation?->items ?? [])
            ->values()
            ->map(fn ($line, $i) => [
                'description' => $line->description,
                'unit'        => $units[$i] ?? null,
                'quantity'    => (float) $line->quantity,
                'unit_price'  => round(((float) $line->unit_price) / ($divisor ?: 1), 2),
                'sd_rate'     => 0,
                'vat_rate'    => $vatRate,
            ]);
    }
}
