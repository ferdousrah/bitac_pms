<?php

namespace App\Services;

use App\Models\DeliveryOrder;

class DeliveryChallanService
{
    /**
     * Render a BITAC-style Delivery Challan PDF via mPDF + letterhead.
     * Returns the binary bytes.
     */
    public function generatePdf(DeliveryOrder $delivery): string
    {
        $delivery->load(['workOrder.product', 'workOrder.customer', 'pod']);
        $wo       = $delivery->workOrder;
        $customer = $wo->customer;
        $pod      = $delivery->pod;

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $chal   = $esc($delivery->challan_number);
        $date   = $delivery->scheduled_date?->format('d/m/Y') ?? $delivery->created_at?->format('d/m/Y') ?? '';
        $woNo   = $esc($wo->wo_number ?? '—');
        $jobNo  = $esc($wo->job_number ?? '—');
        $cust   = $esc($customer?->name ?? '—');
        $addr   = $esc($delivery->delivery_address ?? $customer?->address ?? '—');
        $vehicle= $esc($delivery->vehicle_number ?? '—');
        $driver = $esc($delivery->driver_name ?? '—');

        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $chal . '</td>'
            .   '<td style="font-size: 11pt; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($date) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        $title = '<div style="text-align: center; margin-bottom: 12pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt;">ডেলিভারি চালান</div>'
            . '<div style="font-size: 11pt; margin-top: 1pt; font-weight: bold;">(DELIVERY CHALLAN)</div>'
            . '</div>';

        $header = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="55%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; vertical-align: top; line-height: 1.5;">'
            .     '<div style="font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt; margin-bottom: 3pt;">Deliver To</div>'
            .     '<div style="font-weight: bold; font-size: 11pt;">' . $cust . '</div>'
            .     '<div style="color: #444;">' . nl2br($addr, false) . '</div>'
            .   '</td>'
            .   '<td width="45%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; vertical-align: top; line-height: 1.6;">'
            .     '<div><b>Challan No:</b> ' . $chal . '</div>'
            .     '<div><b>Job No:</b> ' . $jobNo . '</div>'
            .     '<div><b>WO No:</b> ' . $woNo . '</div>'
            .     '<div><b>Vehicle:</b> ' . $vehicle . '</div>'
            .     '<div><b>Driver:</b> ' . $driver . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // Items — pull from work order's quotation items, fall back to product line
        $rows = '';
        $items = $wo->quotation?->items ?? collect();
        // A delivery ships a specific quantity (quantity_delivered) — for a
        // single-item job that's what the challan must show, NOT the full ordered
        // qty. (Multi-item per-line partial delivery is a future enhancement.)
        $isSingleItem = $items->count() === 1;
        if ($items->isNotEmpty()) {
            $idx = 0;
            foreach ($items as $it) {
                $idx++;
                $qty = $isSingleItem
                    ? (float) $delivery->quantity_delivered
                    : (float) ($it->quantity ?? 0);
                $rows .= '<tr>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">' . str_pad($idx, 2, '0', STR_PAD_LEFT) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 9pt;">' . nl2br($esc($it->description ?? $it->product?->name ?? '—'), false) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">' . number_format($qty, 2) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">' . $esc($it->unit ?? 'pcs') . '</td>'
                    . '</tr>';
            }
        } else {
            $rows .= '<tr>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">01</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 9pt;">' . $esc($wo->product?->name ?? '—') . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">' . number_format((float) $delivery->quantity_delivered, 2) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 9pt;">pcs</td>'
                . '</tr>';
        }

        $itemsTable = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 10pt;">'
            . '<thead><tr style="background: #f3f4f6;">'
            .   '<th width="8%"  style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt;">SL</th>'
            .   '<th             style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; text-align: left;">Item Description</th>'
            .   '<th width="15%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt;">Quantity</th>'
            .   '<th width="12%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt;">Unit</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>';

        $notesBlock = '';
        if (trim((string) $delivery->notes) !== '') {
            $notesBlock = '<div style="border: 0.75pt solid #000; padding: 8pt 10pt; margin-bottom: 12pt; font-size: 9pt; line-height: 1.5;">'
                . '<div style="font-weight: bold; margin-bottom: 3pt;">Transport Notes</div>'
                . nl2br($esc($delivery->notes), false)
                . '</div>';
        }

        $podBlock = '';
        if ($pod) {
            $podBlock = '<div style="border: 0.75pt solid #000; padding: 8pt 10pt; margin-bottom: 12pt; font-size: 9pt; background: #ecfdf5;">'
                . '<div style="font-weight: bold; margin-bottom: 3pt;">Proof of Delivery</div>'
                . 'Received by: <b>' . $esc($pod->received_by) . '</b> on ' . $esc(\Carbon\Carbon::parse($pod->received_at)->format('d/m/Y H:i'))
                . '</div>';
        }

        $signature = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28pt;">'
            . '<tr>'
            .   '<td width="50%" style="font-size: 10pt; vertical-align: bottom;">'
            .     '<div style="min-height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; display: inline-block; min-width: 70%;">'
            .       '<div style="font-weight: bold;">Dispatched By</div>'
            .       '<div style="color: #555; font-size: 9pt;">BITAC Stores</div>'
            .     '</div>'
            .   '</td>'
            .   '<td width="50%" style="font-size: 10pt; vertical-align: bottom; text-align: right;">'
            .     '<div style="min-height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; display: inline-block; min-width: 70%; text-align: center;">'
            .       '<div style="font-weight: bold;">Received By</div>'
            .       '<div style="color: #555; font-size: 9pt;">Customer\'s Representative</div>'
            .     '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        $body = $memoBlock . $title . $header . $itemsTable . $notesBlock . $podBlock . $signature;
        return app(BitacLetterhead::class)->render($body, "Delivery Challan {$delivery->challan_number}");
    }
}
