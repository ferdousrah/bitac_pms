<?php

namespace App\Services;

use App\Models\DeliveryOrder;

class DeliveryChallanService
{
    /** Ruled rows the item table is padded to, as on BITAC's printed challan. */
    private const RULED_ROWS = 20;

    /**
     * Render the Delivery Challan PDF on the BITAC letterhead. Returns the bytes.
     *
     * The layout is BITAC's own printed challan (the one PCD's Executive
     * Engineer signs), transcribed rather than designed: No. / Date, the
     * party's name and address, their Purchase Order No. and date, the Job
     * No., a ruled Part No. | Description | Quantity table padded with blank
     * lines, then the receiver's block bottom-left and the Executive Engineer,
     * Production Control Division bottom-right — both left blank to be signed
     * by hand on the paper.
     */
    public function generatePdf(DeliveryOrder $delivery): string
    {
        $delivery->load(['workOrder.product', 'workOrder.customer', 'workOrder.items', 'workOrder.quotation.items.product']);
        $wo       = $delivery->workOrder;
        $customer = $wo->customer;

        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $qtyFmt = fn ($q) => rtrim(rtrim(number_format((float) $q, 2, '.', ''), '0'), '.');

        $chal  = $esc($delivery->challan_number);
        $date  = ($delivery->scheduled_date ?? $delivery->created_at)?->format('d-m-Y') ?? '';
        $name  = $esc($customer?->name ?? '');
        $addr  = $esc(trim((string) ($delivery->delivery_address ?: $customer?->address ?: '')));
        $poNo  = $esc($wo->customer_po_no ?? '');
        $poDt  = $wo->customer_wo_date?->format('d-m-Y') ?? '';
        $jobNo = $esc($wo->job_number ?? '');

        // ── Lines: PCD's own copy of the job items when it has one (it may
        // have reworded them on the work order), else the quotation's.
        $source = $wo->items->isNotEmpty()
            ? $wo->items->map(fn ($i) => ['desc' => $i->description ?: $i->product?->name, 'qty' => $i->quantity, 'unit' => $i->unit])
            : ($wo->quotation?->items ?? collect())->map(fn ($i) => ['desc' => $i->description ?: $i->product?->name, 'qty' => $i->quantity, 'unit' => $i->unit]);
        if ($source->isEmpty()) {
            $source = collect([['desc' => $wo->product?->name, 'qty' => $delivery->quantity_delivered, 'unit' => 'pcs']]);
        }
        // A delivery ships a specific quantity. For a single-item job that is
        // what the challan shows, not the full order (per-line partial
        // delivery of a multi-item job is not modelled yet).
        if ($source->count() === 1) {
            $source = $source->map(fn ($l) => ['qty' => $delivery->quantity_delivered] + $l);
        }

        $cell = 'border-left: 0.75pt solid #000; border-right: 0.75pt solid #000; border-bottom: 0.5pt solid #000; font-size: 11pt; vertical-align: top;';
        $rows = '';
        foreach ($source->values() as $i => $l) {
            $unit = trim((string) ($l['unit'] ?? ''));
            $rows .= '<tr>'
                . '<td style="' . $cell . ' padding: 3pt 6pt; text-align: center;">' . str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) . '.</td>'
                . '<td style="' . $cell . ' padding: 3pt 8pt; line-height: 1.3;">' . nl2br($esc($l['desc'] ?? ''), false) . '</td>'
                . '<td style="' . $cell . ' padding: 3pt 6pt;">' . $esc($qtyFmt($l['qty'] ?? 0) . ($unit !== '' ? ' ' . ucfirst($unit) : '')) . '</td>'
                . '</tr>';
        }
        for ($i = $source->count(); $i < self::RULED_ROWS; $i++) {
            $rows .= '<tr><td style="' . $cell . ' height: 15pt;">&nbsp;</td><td style="' . $cell . '">&nbsp;</td><td style="' . $cell . '">&nbsp;</td></tr>';
        }

        $th = 'border: 0.75pt solid #000; padding: 3pt 6pt; font-size: 11pt; font-weight: bold;';
        $items = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-top: 4pt;">'
            . '<thead><tr>'
            .   '<th width="12%" style="' . $th . ' text-align: center;">Part No.</th>'
            .   '<th style="' . $th . ' text-align: left;">Description</th>'
            .   '<th width="14%" style="' . $th . ' text-align: left;">Quantity</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>';

        $line = fn (string $label, string $value) => '<div style="font-size: 11pt; margin-bottom: 3pt;">' . $label . ' ' . $value . '</div>';

        $head = '<div style="text-align: center; font-size: 14pt; font-weight: bold; margin: 2pt 0 14pt;">DELIVERY CHALLAN</div>'
            . '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 4pt;">'
            .   '<tr>'
            .     '<td style="font-size: 12pt; font-weight: bold;">No. ' . $chal . '</td>'
            .     '<td style="font-size: 12pt; text-align: right;">Date: ' . $esc($date) . '</td>'
            .   '</tr>'
            . '</table>'
            . $line('Name:', $name)
            . $line('Address:', nl2br($addr, false))
            . '<div style="height: 8pt;"></div>'
            . $line('Purchase Order No:', $poNo . ($poDt !== '' ? '. &nbsp; Date: ' . $esc($poDt) . '.' : ''))
            . '<div style="height: 6pt;"></div>'
            . $line('Job No:', $jobNo);

        // Each block is its own small table: the empty row is the space for
        // the pen, and the rule is the top border of the cell under it. mPDF
        // draws cell borders reliably; borders on a <div> in a table cell come
        // out the width of the text, or under every <br> line.
        $sig = fn (string $inner) => '<td width="38%" style="vertical-align: bottom;">'
            . '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">'
            .   '<tr><td style="height: 40pt;">&nbsp;</td></tr>'
            .   '<tr><td style="border-top: 0.75pt solid #000; padding-top: 3pt; font-size: 11pt; font-weight: bold; line-height: 1.45;">' . $inner . '</td></tr>'
            . '</table>'
            . '</td>';

        $signatures = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   $sig('Signature of receiver<br>Name:<br>Designation:<br>Phone Number:')
            .   '<td width="24%">&nbsp;</td>'
            .   $sig('Signature<br>Executive Engineer<br>Production Control Division<br>Phone Number:')
            . '</tr>'
            . '</table>';

        return app(BitacLetterhead::class)->render($head . $items . $signatures, "Delivery Challan {$delivery->challan_number}");
    }
}
