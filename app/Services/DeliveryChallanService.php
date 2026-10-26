<?php

namespace App\Services;

use App\Models\DeliveryOrder;

class DeliveryChallanService
{
    /** Ruled rows the item table is padded to, as on BITAC's printed challan. */
    private const RULED_ROWS = 20;

    private const CELL = 'border-left: 0.75pt solid #000; border-right: 0.75pt solid #000; border-bottom: 0.5pt solid #000; font-size: 11pt; vertical-align: top;';
    private const TH   = 'border: 0.75pt solid #000; padding: 3pt 6pt; font-size: 11pt; font-weight: bold;';

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
     *
     * A delivery recorded with lines (since 2026-10-24) prints those. A
     * PARTIAL one is the Partial Challan: titled so, and each line shows what
     * was ordered, what went earlier, what is on this challan and the balance.
     * A FULL one keeps the paper's three columns.
     */
    public function generatePdf(DeliveryOrder $delivery): string
    {
        $delivery->load(['workOrder.product', 'workOrder.customer', 'workOrder.items.product', 'workOrder.quotation.items', 'items']);

        $table = $delivery->items->isNotEmpty()
            ? ($delivery->type === 'partial' ? $this->partialTable($delivery) : $this->fullTable($delivery))
            : $this->legacyTable($delivery);

        return $this->render($delivery, $table);
    }

    private static function esc($v): string
    {
        return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private static function qty($q): string
    {
        return rtrim(rtrim(number_format((float) $q, 2, '.', ''), '0'), '.');
    }

    /** "6 Pcs" — the quantity with its unit, as the paper writes it. */
    private static function qtyUnit($q, ?string $unit): string
    {
        $unit = trim((string) $unit);

        return self::esc(self::qty($q) . ($unit !== '' ? ' ' . ucfirst($unit) : ''));
    }

    /** The paper's three columns: Part No. | Description | Quantity. */
    private function threeColumnTable($lines): string
    {
        $c = self::CELL;
        $rows = '';
        foreach ($lines->values() as $i => $l) {
            $rows .= '<tr>'
                . '<td style="' . $c . ' padding: 3pt 6pt; text-align: center;">' . self::esc($l['part_no'] ?? str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) . '.') . '</td>'
                . '<td style="' . $c . ' padding: 3pt 8pt; line-height: 1.3;">' . nl2br(self::esc($l['desc'] ?? ''), false) . '</td>'
                . '<td style="' . $c . ' padding: 3pt 6pt;">' . self::qtyUnit($l['qty'] ?? 0, $l['unit'] ?? '') . '</td>'
                . '</tr>';
        }
        for ($i = $lines->count(); $i < self::RULED_ROWS; $i++) {
            $rows .= '<tr><td style="' . $c . ' height: 15pt;">&nbsp;</td><td style="' . $c . '">&nbsp;</td><td style="' . $c . '">&nbsp;</td></tr>';
        }

        $th = self::TH;

        return '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-top: 4pt;">'
            . '<thead><tr>'
            .   '<th width="12%" style="' . $th . ' text-align: center;">Part No.</th>'
            .   '<th style="' . $th . ' text-align: left;">Description</th>'
            .   '<th width="14%" style="' . $th . ' text-align: left;">Quantity</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>';
    }

    /** A full delivery recorded with lines: the paper's layout, this challan's quantities. */
    private function fullTable(DeliveryOrder $delivery): string
    {
        return $this->threeColumnTable($delivery->items->map(fn ($i) => [
            'part_no' => $i->part_no, 'desc' => $i->description, 'qty' => $i->quantity, 'unit' => $i->unit,
        ]));
    }

    /**
     * The Partial Challan's table: per job item, ordered · delivered earlier ·
     * this challan · balance. Every item of the job is listed — one with
     * nothing on this challan shows a dash — so the paper says plainly what is
     * still to come.
     */
    private function partialTable(DeliveryOrder $delivery): string
    {
        $mine = $delivery->items->keyBy(fn ($i) => (int) ($i->work_order_item_id ?? 0));
        $lines = DeliveryLines::forWorkOrder($delivery->workOrder, $delivery->id)->map(function ($l) use ($mine) {
            $now = (float) ($mine[$l['key']]->quantity ?? 0);

            return $l + ['now' => $now, 'balance' => max(0, round($l['ordered'] - $l['earlier'] - $now, 2))];
        });

        $c = self::CELL;
        $rows = '';
        foreach ($lines->values() as $i => $l) {
            $num = fn ($v, bool $bold = false) => '<td style="' . $c . ' padding: 3pt 6pt; text-align: right;' . ($bold ? ' font-weight: bold;' : '') . '">'
                . ($v > 0 ? self::qtyUnit($v, $l['unit']) : '—') . '</td>';
            $rows .= '<tr>'
                . '<td style="' . $c . ' padding: 3pt 6pt; text-align: center;">' . self::esc($l['part_no'] ?? str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) . '.') . '</td>'
                . '<td style="' . $c . ' padding: 3pt 8pt; line-height: 1.3;">' . nl2br(self::esc($l['description']), false) . '</td>'
                . $num($l['ordered']) . $num($l['earlier']) . $num($l['now'], true) . $num($l['balance'])
                . '</tr>';
        }
        for ($i = $lines->count(); $i < self::RULED_ROWS - 4; $i++) {
            $rows .= '<tr>' . str_repeat('<td style="' . $c . ' height: 15pt;">&nbsp;</td>', 6) . '</tr>';
        }

        $th = self::TH;
        $balance = $lines->sum('balance');

        return '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-top: 4pt;">'
            . '<thead><tr>'
            .   '<th width="10%" style="' . $th . ' text-align: center;">Part No.</th>'
            .   '<th style="' . $th . ' text-align: left;">Description</th>'
            .   '<th width="12%" style="' . $th . ' text-align: right;">Ordered</th>'
            .   '<th width="13%" style="' . $th . ' text-align: right;">Delivered earlier</th>'
            .   '<th width="13%" style="' . $th . ' text-align: right;">This challan</th>'
            .   '<th width="12%" style="' . $th . ' text-align: right;">Balance</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>'
            . '<div style="font-size: 10pt; margin-top: 4pt;">'
            . ($balance > 0.001
                ? '<b>Partial delivery</b> — the balance above is still to be delivered.'
                : '<b>Final part of a partial delivery</b> — with this challan the whole order has been delivered.')
            . '</div>';
    }

    /** Deliveries made before lines existed: the layout as it always was. */
    private function legacyTable(DeliveryOrder $delivery): string
    {
        $wo = $delivery->workOrder;
        // Lines: PCD's own copy of the job items when it has one (it may have
        // reworded them on the work order), else the quotation's.
        $source = $wo->items->isNotEmpty()
            ? $wo->items->map(fn ($i) => ['desc' => $i->description ?: $i->product?->name, 'qty' => $i->quantity, 'unit' => $i->unit])
            // QuotationItem has no product relation — its description is the line.
            : ($wo->quotation?->items ?? collect())->map(fn ($i) => ['desc' => $i->description, 'qty' => $i->quantity, 'unit' => 'pcs']);
        if ($source->isEmpty()) {
            $source = collect([['desc' => $wo->product?->name, 'qty' => $delivery->quantity_delivered, 'unit' => 'pcs']]);
        }
        // A single-item job shows the quantity this delivery shipped, not the
        // full order. (A multi-item delivery from before lines existed recorded
        // only a total, so it cannot say per line.)
        if ($source->count() === 1) {
            $source = $source->map(fn ($l) => ['qty' => $delivery->quantity_delivered] + $l);
        }

        return $this->threeColumnTable($source);
    }

    private function render(DeliveryOrder $delivery, string $table): string
    {
        $wo       = $delivery->workOrder;
        $customer = $wo->customer;
        $esc      = fn ($v) => self::esc($v);
        $partial  = $delivery->type === 'partial';

        $chal  = $esc($delivery->challan_number);
        $date  = ($delivery->scheduled_date ?? $delivery->created_at)?->format('d-m-Y') ?? '';
        $name  = $esc($customer?->name ?? '');
        $addr  = $esc(trim((string) ($delivery->delivery_address ?: $customer?->address ?: '')));
        $poNo  = $esc($wo->customer_po_no ?? '');
        $poDt  = $wo->customer_wo_date?->format('d-m-Y') ?? '';
        $jobNo = $esc($wo->job_number ?? '');

        $line = fn (string $label, string $value) => '<div style="font-size: 11pt; margin-bottom: 3pt;">' . $label . ' ' . $value . '</div>';

        $title = $partial
            ? 'PARTIAL DELIVERY CHALLAN <span class="bn" style="font-family: nikosh; font-weight: normal; font-size: 12pt;">(আংশিক)</span>'
            : 'DELIVERY CHALLAN';

        $head = '<div style="text-align: center; font-size: 14pt; font-weight: bold; margin: 2pt 0 14pt;">' . $title . '</div>'
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
        // The XEN's block carries his signature once he has signed the
        // challan (ChallanApproval) — image alone, width-sized, in the space
        // for the pen; the printed labels under the rule stay.
        $xenSig = $delivery->challan_signature_path
            ? \Illuminate\Support\Facades\Storage::disk('public')->path($delivery->challan_signature_path) : null;
        $xenSig = ($xenSig && is_file($xenSig)) ? $xenSig : null;

        $sig = fn (string $inner, ?string $image = null) => '<td width="38%" style="vertical-align: bottom;">'
            . '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">'
            .   ($image
                    ? '<tr><td style="vertical-align: bottom;">' . \App\Support\SignatureBlock::html($image, [], 40, 150, 'left') . '</td></tr>'
                    : '<tr><td style="height: 40pt;">&nbsp;</td></tr>')
            .   '<tr><td style="border-top: 0.75pt solid #000; padding-top: 3pt; font-size: 11pt; font-weight: bold; line-height: 1.45;">' . $inner . '</td></tr>'
            . '</table>'
            . '</td>';

        $signatures = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   $sig('Signature of receiver<br>Name:<br>Designation:<br>Phone Number:')
            .   '<td width="24%">&nbsp;</td>'
            .   $sig('Signature<br>Executive Engineer<br>Production Control Division<br>Phone Number:', $xenSig)
            . '</tr>'
            . '</table>';

        return app(BitacLetterhead::class)->render($head . $table . $signatures,
            ($partial ? 'Partial Delivery Challan ' : 'Delivery Challan ') . $delivery->challan_number);
    }
}
