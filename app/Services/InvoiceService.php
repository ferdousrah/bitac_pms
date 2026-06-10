<?php

namespace App\Services;

use App\Models\DeliveryOrder;
use App\Models\Invoice;

class InvoiceService
{
    public function createFromDelivery(DeliveryOrder $delivery): Invoice
    {
        $workOrder  = $delivery->workOrder;
        $quotation  = $workOrder->quotation;
        $vatRate    = $quotation?->vat_rate !== null ? (float) $quotation->vat_rate : (float) config('app.vat_rate', 15);
        $taxRate    = (float) ($quotation?->tax_rate ?? 0);

        // BITAC quotations are VAT-inclusive — strip out embedded VAT so the
        // invoice shows the legal split (subtotal + VAT + Tax = total).
        // Tax (e.g. AIT) is additive on top of the VAT-inclusive total.
        if ($quotation) {
            $quoteTotal = (float) $quotation->total_amount;
            // Reverse out the tax portion the quotation already added on top
            $taxAmount  = (float) ($quotation->tax_amount ?? 0);
            $grossVatIncl = $quoteTotal - $taxAmount;
            $vatAmount  = $grossVatIncl * ($vatRate / (100 + $vatRate));
            $subtotal   = $grossVatIncl - $vatAmount;
            $total      = $grossVatIncl + $taxAmount;
        } else {
            $subtotal = $vatAmount = $taxAmount = $total = 0.0;
        }

        $year  = now()->year;
        $count = Invoice::whereYear('created_at', $year)->count();
        $invoiceNumber = 'INV-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        return Invoice::create([
            'invoice_number'    => $invoiceNumber,
            'work_order_id'     => $workOrder->id,
            'delivery_order_id' => $delivery->id,
            'customer_id'       => $workOrder->customer_id,
            'subtotal'          => round($subtotal, 2),
            'vat_rate'          => round($vatRate, 2),
            'vat_amount'        => round($vatAmount, 2),
            'tax_rate'          => round($taxRate, 2),
            'tax_amount'        => round($taxAmount, 2),
            'discount'          => 0,
            'total_amount'      => round($total, 2),
            'status'            => 'issued',
            'issued_at'         => now(),
        ]);
    }

    /**
     * Render a BITAC-style Tax Invoice PDF via mPDF + letterhead.
     * Plain paper-form layout — black borders, bilingual title, items table,
     * subtotal / VAT / total, amount in words, payment instructions,
     * authorised-signatory block.
     */
    public function generatePdf(Invoice $invoice): string
    {
        $invoice->load(['workOrder.product', 'workOrder.customer', 'workOrder.quotation.items', 'deliveryOrder']);

        $wo        = $invoice->workOrder;
        $customer  = $wo->customer;
        $quotation = $wo->quotation;
        $delivery  = $invoice->deliveryOrder;

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);

        $invNo   = $esc($invoice->invoice_number);
        $issued  = $invoice->issued_at?->format('d/m/Y') ?? '';
        $dueDate = $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d/m/Y') : 'On Receipt';
        $woNo    = $esc($wo->wo_number ?? '—');
        $jobNo   = $esc($wo->job_number ?? '—');
        $custName= $esc($customer?->name ?? '—');
        $custAddr= $esc($customer?->address ?? '—');
        $custCt  = $esc($customer?->contact_person ?? '');
        $custPhn = $esc($customer?->phone ?? '');
        $custBin = $esc($customer?->bin_number ?? '');
        $chal    = $esc($delivery?->challan_number ?? '—');
        $vatRate = (float) config('app.vat_rate', 15);

        // ── Memo strip ─────────────────────────────────────────────
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $invNo . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($issued) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // ── Title ──────────────────────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 12pt;">'
            . '<div style="font-size: 13pt; color: #000; font-weight: bold;">INVOICE</div>'
            . '</div>';

        // ── Billed To / Invoice meta blocks ───────────────────────
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="55%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div style="font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt; margin-bottom: 3pt;">Billed To</div>'
            .     '<div style="font-weight: bold; font-size: 11pt;">' . $custName . '</div>'
            .     ($custCt    ? '<div>Attn: ' . $custCt . '</div>' : '')
            .     '<div style="color: #444;">' . $custAddr . '</div>'
            .     ($custPhn   ? '<div style="color: #444; font-size: 9pt;">Phone: ' . $custPhn . '</div>' : '')
            .     ($custBin   ? '<div style="color: #444; font-size: 9pt;">BIN: ' . $custBin . '</div>' : '')
            .   '</td>'
            .   '<td width="45%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.6;">'
            .     '<div><b>Job No:</b> ' . $jobNo . '</div>'
            .     '<div><b>WO No:</b> ' . $woNo . '</div>'
            .     '<div><b>Challan No:</b> ' . $chal . '</div>'
            .     '<div><b>Issue Date:</b> ' . $esc($issued) . '</div>'
            .     '<div><b>Due Date:</b> ' . $esc($dueDate) . '</div>'
            .     '<div><b>Payment Terms:</b> ' . $esc($invoice->payment_terms ?? 'Net 30 days') . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ── Items table ───────────────────────────────────────────
        // Pull line items from the linked quotation; if none, fall back to
        // a single WO-product line.
        $rows = '';
        $idx = 0;
        $items = $quotation?->items ?? collect();

        if ($items->isNotEmpty()) {
            $totalQty = 0;
            $vatAlreadyEmbedded = true; // BITAC quotations are VAT-inclusive
            foreach ($items as $it) {
                $idx++;
                $qty   = (float) ($it->quantity ?? 0);
                $unit  = (float) ($it->unit_price ?? 0);
                // Strip embedded VAT from unit price so the line amount sits
                // pre-VAT and the totals math works out.
                $unitNet = $vatAlreadyEmbedded ? ($unit / (1 + $vatRate / 100)) : $unit;
                $line    = $qty * $unitNet;
                $totalQty += $qty;
                $desc  = $esc($it->description ?? $it->product?->name ?? '—');
                $rows .= '<tr>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt; vertical-align: top;">' . str_pad($idx, 2, '0', STR_PAD_LEFT) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 9pt; vertical-align: top;">' . nl2br($desc, false) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt; vertical-align: top;">' . $fmt($qty) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: right; font-size: 9pt; font-family: monospace; vertical-align: top;">' . $fmt($unitNet) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: right; font-size: 9pt; font-family: monospace; vertical-align: top;">' . $fmt($line) . '</td>'
                    . '</tr>';
            }
        } else {
            $idx = 1;
            $qty = (float) $wo->quantity;
            $unit = $qty > 0 ? ($invoice->subtotal / $qty) : 0;
            $desc = $esc($wo->product?->name ?? '—');
            $rows .= '<tr>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">01</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 9pt;">' . $desc . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">' . $fmt($qty) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: right; font-size: 9pt; font-family: monospace;">' . $fmt($unit) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: right; font-size: 9pt; font-family: monospace;">' . $fmt($invoice->subtotal) . '</td>'
                . '</tr>';
        }

        $itemsTable = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 10pt;">'
            . '<thead><tr style="background: #f3f4f6;">'
            .   '<th width="6%"  style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt;">SL</th>'
            .   '<th             style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; text-align: left;">Description</th>'
            .   '<th width="10%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt;">Qty</th>'
            .   '<th width="16%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; text-align: right;">Unit Price (৳)</th>'
            .   '<th width="18%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; text-align: right;">Amount (৳)</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>';

        // ── Totals block + amount in words ────────────────────────
        $discount = (float) ($invoice->discount ?? 0);
        $amountWords = $this->amountInWords((float) $invoice->total_amount);

        $totalsBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 12pt;">'
            . '<tr>'
            .   '<td width="55%" style="border: 0.75pt solid #000; padding: 8pt 10pt; vertical-align: top; font-size: 10pt;">'
            .     '<div style="font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt;">Amount in Words</div>'
            .     '<div style="font-weight: bold; font-style: italic; margin-top: 4pt;">' . $esc($amountWords) . '</div>'
            .   '</td>'
            .   '<td width="45%" style="border: 0.75pt solid #000; padding: 0; vertical-align: top;">'
            .     '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">'
            .       '<tr><td style="padding: 4pt 8pt; font-size: 10pt;">Subtotal</td><td style="padding: 4pt 8pt; text-align: right; font-family: monospace; font-size: 10pt;">৳ ' . $fmt($invoice->subtotal) . '</td></tr>'
            .       ($discount > 0
                       ? '<tr><td style="padding: 4pt 8pt; font-size: 10pt; color: #dc2626;">Discount</td><td style="padding: 4pt 8pt; text-align: right; font-family: monospace; font-size: 10pt; color: #dc2626;">- ৳ ' . $fmt($discount) . '</td></tr>'
                       : '')
            .       '<tr><td style="padding: 4pt 8pt; font-size: 10pt; border-top: 0.5pt solid #ccc;">VAT (' . $fmt($vatRate) . '%)</td><td style="padding: 4pt 8pt; text-align: right; font-family: monospace; font-size: 10pt; border-top: 0.5pt solid #ccc;">৳ ' . $fmt($invoice->vat_amount) . '</td></tr>'
            .       (((float) ($invoice->tax_amount ?? 0)) > 0
                       ? '<tr><td style="padding: 4pt 8pt; font-size: 10pt; border-top: 0.5pt solid #ccc;">Tax (' . $fmt($invoice->tax_rate ?? 0) . '%)</td><td style="padding: 4pt 8pt; text-align: right; font-family: monospace; font-size: 10pt; border-top: 0.5pt solid #ccc;">৳ ' . $fmt($invoice->tax_amount) . '</td></tr>'
                       : '')
            .       '<tr style="background: #f3f4f6;"><td style="padding: 6pt 8pt; font-size: 11pt; font-weight: bold; border-top: 0.75pt solid #000;">TOTAL DUE</td><td style="padding: 6pt 8pt; text-align: right; font-family: monospace; font-size: 11pt; font-weight: bold; border-top: 0.75pt solid #000;">৳ ' . $fmt($invoice->total_amount) . '</td></tr>'
            .     '</table>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ── Payment instructions ──────────────────────────────────
        $paymentBlock = '<div style="border: 0.75pt solid #000; padding: 8pt 10pt; margin-bottom: 12pt; font-size: 9pt; color: #000; line-height: 1.5;">'
            . '<div style="font-weight: bold; margin-bottom: 3pt;">Payment Instructions</div>'
            . 'Please make payment by Account Payee Cheque / DD / Online Transfer in favour of <b>"Bangladesh Industrial Technical Assistance Centre"</b>.<br>'
            . 'Bank: <b>Sonali Bank Ltd, Tejgaon Branch, Dhaka</b> · A/C No: <b>0000-0000-0000</b> · Routing: <b>200261234</b><br>'
            . 'Please quote invoice number <b>' . $invNo . '</b> in the payment reference.'
            . '</div>';

        // ── Signature block ───────────────────────────────────────
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28pt;">'
            . '<tr>'
            .   '<td width="50%" style="font-size: 10pt; color: #000; vertical-align: bottom;">'
            .     '<div style="min-height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; margin-top: 2pt; display: inline-block; min-width: 70%;">'
            .       '<div style="font-weight: bold;">Accounts Officer</div>'
            .       '<div style="color: #555; font-size: 9pt;">Accounts &amp; Finance</div>'
            .     '</div>'
            .   '</td>'
            .   '<td width="50%" style="font-size: 10pt; color: #000; vertical-align: bottom; text-align: right;">'
            .     '<div style="min-height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; margin-top: 2pt; display: inline-block; min-width: 70%; text-align: center;">'
            .       '<div style="font-weight: bold;">Authorised Signatory</div>'
            .       '<div style="color: #555; font-size: 9pt;">BITAC</div>'
            .     '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        $body = $memoBlock . $titleBlock . $headerBlock . $itemsTable . $totalsBlock . $paymentBlock . $signatureBlock;

        return app(BitacLetterhead::class)->render($body, "Tax Invoice {$invoice->invoice_number}");
    }

    /**
     * Convert a BDT amount to Indian-system words. Identical helper to the one
     * used by Quotation PDFs so customers see consistent phrasing.
     */
    private function amountInWords(float $amount): string
    {
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        $twoDigit = function (int $n) use ($ones, $tens): string {
            if ($n < 20) return $ones[$n];
            $t = intdiv($n, 10);
            $o = $n % 10;
            return trim($tens[$t] . ($o ? ' ' . $ones[$o] : ''));
        };

        $threeDigit = function (int $n) use ($ones, $twoDigit): string {
            $parts = [];
            if ($n >= 100) {
                $parts[] = $ones[intdiv($n, 100)] . ' Hundred';
                $n %= 100;
            }
            if ($n > 0) $parts[] = $twoDigit($n);
            return implode(' ', $parts);
        };

        $taka  = (int) floor($amount);
        $paisa = (int) round(($amount - $taka) * 100);

        if ($taka === 0) {
            $takaWords = 'Zero';
        } else {
            $crore = intdiv($taka, 10000000);   $taka %= 10000000;
            $lac   = intdiv($taka, 100000);     $taka %= 100000;
            $thou  = intdiv($taka, 1000);       $taka %= 1000;
            $rest  = $taka;

            $parts = [];
            if ($crore) $parts[] = $threeDigit($crore) . ' Crore';
            if ($lac)   $parts[] = $threeDigit($lac)   . ' Lac';
            if ($thou)  $parts[] = $threeDigit($thou)  . ' Thousand';
            if ($rest)  $parts[] = $threeDigit($rest);
            $takaWords = implode(' ', $parts);
        }

        $result = $takaWords . ' Taka';
        if ($paisa > 0) {
            $result .= ' and ' . $twoDigit($paisa) . ' Paisa';
        }
        return $result . ' Only';
    }
}
