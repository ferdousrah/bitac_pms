<?php

namespace App\Services;

use App\Models\Invoice;

/**
 * Building a মূসক ৬.৩ — the line arithmetic, and pricing a bill's lines
 * for the form.
 *
 * ⚠️ **Nothing raises a tax challan automatically.** It was briefly wired to
 * fire when a delivery was confirmed; BITAC did not want that coupling
 * (2026-09-29). A challan is issued deliberately, from the bill, through the
 * form — so that a person has checked the destination, the vehicle and the
 * signatory before a legal document goes out.
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
