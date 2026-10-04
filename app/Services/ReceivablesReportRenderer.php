<?php

namespace App\Services;

/**
 * The receivables report, printed.
 *
 * ⚠️ It renders whatever `ReceivablesController::build()` hands it and
 * computes nothing of its own. A printed total that disagrees with the screen
 * is the one failure nobody can explain away.
 *
 * ⚠️ **Landscape (A4-L).** Seven money columns plus a client name do not fit
 * A4 portrait without wrapping, and a receivables figure that wraps is a
 * figure nobody can read down a column. `BitacLetterhead::render()` takes the
 * format as an override; the letterhead block is laid out in percentages so it
 * follows the wider page.
 *
 * Two tables, because they answer two different questions: what each client
 * owes, and how old it is. The classic receivables sheet carries both.
 */
class ReceivablesReportRenderer
{
    private const INK   = '#111';
    private const MUTED = '#555';
    private const RULE  = '#999';

    public function render(array $data): string
    {
        $rows   = $data['rows'];
        $totals = $data['totals'];
        $ageing = $data['ageing'];

        $body = $this->titleBlock($data['filters'])
            . $this->summaryBlock($totals, $ageing)
            . $this->outstandingTable($rows, $totals)
            . $this->ageingTable($rows, $ageing)
            . $this->footNote();

        return app(BitacLetterhead::class)->render(
            $body,
            'Receivables ' . now()->format('d-m-Y'),
            null,
            'bn',
            // Wide report — see the note above.
            ['format' => 'A4-L'],
        );
    }

    // ─────────────────────────────────────────────────────────────────────

    private function titleBlock(array $filters): string
    {
        $scope = [];
        if (! empty($filters['search'])) {
            $scope[] = 'client matching “' . $this->esc($filters['search']) . '”';
        }
        $scope[] = ! empty($filters['only_due'])
            ? 'only clients with money outstanding'
            : 'every client with a bill';

        return '<div style="text-align: center; margin-bottom: 10pt;">'
            . '<div class="bn" style="font-size: 14pt; font-weight: bold; color: ' . self::INK . ';">বকেয়া পাওনার বিবরণী</div>'
            . '<div style="font-size: 11pt; font-weight: bold; letter-spacing: 0.5pt; color: ' . self::INK . ';">(STATEMENT OF RECEIVABLES)</div>'
            . '<div style="font-size: 8.5pt; color: ' . self::MUTED . '; margin-top: 3pt;">'
            .   'As on ' . now()->format('d F Y')
            .   ' &nbsp;·&nbsp; all amounts in BDT (<span class="bn">৳</span>)'
            .   ' &nbsp;·&nbsp; ' . implode(' &nbsp;·&nbsp; ', $scope)
            . '</div>'
            . '</div>';
    }

    /** The figures a manager reads first. */
    private function summaryBlock(array $totals, array $ageing): string
    {
        $tile = fn (string $label, float $value, string $ink = self::INK) =>
            '<td style="width: 14.28%; border: 0.5pt solid ' . self::RULE . '; padding: 5pt 4pt; text-align: center;">'
            . '<div style="font-size: 7pt; color: ' . self::MUTED . '; text-transform: uppercase; letter-spacing: 0.4pt;">'
            . $this->esc($label) . '</div>'
            . '<div style="font-size: 10.5pt; font-weight: bold; color: ' . $ink . '; margin-top: 2pt;">'
            . $this->money($value) . '</div>'
            . '</td>';

        $html = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt;"><tr>'
            . $tile('Billed', $totals['billed'])
            . $tile('Settled', $totals['settled'])
            . $tile('Due', $totals['due'])
            . $tile('Overdue', $totals['overdue'])
            . $tile('Security held', $totals['security_held'])
            . $tile('Advance in hand', $totals['advance_available'])
            . $tile('Net receivable', $totals['net_receivable'])
            . '</tr></table>';

        return $html;
    }

    /** What each client owes. */
    private function outstandingTable($rows, array $totals): string
    {
        $head = ['Client', 'Bills', 'Billed', 'Settled', 'Due', 'Overdue', 'Security held', 'Advance in hand', 'Net receivable'];
        $widths = ['24%', '5%', '10%', '10%', '10%', '9%', '11%', '11%', '10%'];

        $html = $this->sectionHeading('1. Outstanding by client')
            . '<table width="100%" cellspacing="0" cellpadding="0" style="font-size: 8pt; border: 0.5pt solid ' . self::RULE . ';">'
            . '<thead><tr>';

        foreach ($head as $i => $label) {
            $align = $i === 0 ? 'left' : ($i === 1 ? 'center' : 'right');
            $html .= '<th width="' . $widths[$i] . '" style="border-bottom: 0.75pt solid ' . self::INK . '; '
                . 'padding: 4pt 4pt; text-align: ' . $align . '; font-size: 7.5pt; '
                . 'background: #f1f1f1; color: ' . self::INK . ';">' . $this->esc($label) . '</th>';
        }
        $html .= '</tr></thead><tbody>';

        if (count($rows) === 0) {
            $html .= '<tr><td colspan="9" style="padding: 10pt; text-align: center; color: ' . self::MUTED . ';">'
                . 'Nothing outstanding — every bill is settled.</td></tr>';
        }

        foreach ($rows as $i => $row) {
            // A light band every other row; a wide money table is misread
            // across the line otherwise.
            $bg = $i % 2 ? ' background: #fafafa;' : '';
            $cell = fn ($v, string $align = 'right', string $ink = self::INK, bool $bold = false) =>
                '<td style="border-bottom: 0.25pt solid #ddd; padding: 3pt 4pt; text-align: ' . $align . ';'
                . $bg . ' color: ' . $ink . ';' . ($bold ? ' font-weight: bold;' : '') . '">' . $v . '</td>';

            $html .= '<tr>'
                . $cell($this->esc($row['customer']), 'left')
                . $cell((string) $row['invoice_count'], 'center', self::MUTED)
                . $cell($this->money($row['billed']))
                . $cell($this->money($row['settled']))
                . $cell($this->money($row['due']), 'right', self::INK, true)
                . $cell($row['overdue'] > 0 ? $this->money($row['overdue']) : '—')
                . $cell($row['security_held'] > 0 ? $this->money($row['security_held']) : '—')
                . $cell($row['advance_available'] > 0 ? $this->money($row['advance_available']) : '—')
                . $cell($this->money($row['net_receivable']), 'right', self::INK, true)
                . '</tr>';
        }

        $html .= '</tbody><tfoot><tr>'
            . $this->footCell('Total', 'left')
            . $this->footCell('', 'center')
            . $this->footCell($this->money($totals['billed']))
            . $this->footCell($this->money($totals['settled']))
            . $this->footCell($this->money($totals['due']))
            . $this->footCell($this->money($totals['overdue']))
            . $this->footCell($this->money($totals['security_held']))
            . $this->footCell($this->money($totals['advance_available']))
            . $this->footCell($this->money($totals['net_receivable']))
            . '</tr></tfoot></table>';

        return $html;
    }

    /** How old the dues are. */
    private function ageingTable($rows, array $ageing): string
    {
        $buckets = PaymentLedger::BUCKETS;
        $labels  = PaymentLedger::BUCKET_LABELS;

        // Clients with nothing outstanding have no ageing to show; printing
        // a row of dashes for them only makes the sheet longer.
        $withDue = collect($rows)->filter(fn ($r) => $r['due'] > PaymentLedger::TOLERANCE)->values();

        $html = $this->sectionHeading('2. Ageing of the dues'
                . ' — from ' . PaymentLedger::CREDIT_DAYS . ' days after a bill was issued')
            . '<table width="100%" cellspacing="0" cellpadding="0" style="font-size: 8pt; border: 0.5pt solid ' . self::RULE . ';">'
            . '<thead><tr>'
            . '<th width="30%" style="border-bottom: 0.75pt solid ' . self::INK . '; padding: 4pt; text-align: left; '
            . 'font-size: 7.5pt; background: #f1f1f1;">Client</th>';

        foreach ($buckets as $bucket) {
            $html .= '<th width="12%" style="border-bottom: 0.75pt solid ' . self::INK . '; padding: 4pt; '
                . 'text-align: right; font-size: 7.5pt; background: #f1f1f1;">'
                . $this->esc($labels[$bucket]) . '</th>';
        }
        $html .= '<th width="10%" style="border-bottom: 0.75pt solid ' . self::INK . '; padding: 4pt; '
            . 'text-align: right; font-size: 7.5pt; background: #f1f1f1;">Total due</th></tr></thead><tbody>';

        if ($withDue->count() === 0) {
            $html .= '<tr><td colspan="' . (count($buckets) + 2) . '" style="padding: 10pt; text-align: center; color: '
                . self::MUTED . ';">No dues to age.</td></tr>';
        }

        foreach ($withDue as $i => $row) {
            $bg = $i % 2 ? ' background: #fafafa;' : '';
            $html .= '<tr><td style="border-bottom: 0.25pt solid #ddd; padding: 3pt 4pt;' . $bg . '">'
                . $this->esc($row['customer']) . '</td>';

            foreach ($buckets as $bucket) {
                $value = (float) ($row['ageing'][$bucket] ?? 0);
                $html .= '<td style="border-bottom: 0.25pt solid #ddd; padding: 3pt 4pt; text-align: right;' . $bg . '">'
                    . ($value > 0 ? $this->money($value) : '—') . '</td>';
            }

            $html .= '<td style="border-bottom: 0.25pt solid #ddd; padding: 3pt 4pt; text-align: right; font-weight: bold;'
                . $bg . '">' . $this->money($row['due']) . '</td></tr>';
        }

        $html .= '</tbody><tfoot><tr>' . $this->footCell('Total', 'left');
        foreach ($buckets as $bucket) {
            $html .= $this->footCell($this->money((float) ($ageing[$bucket] ?? 0)));
        }
        $html .= $this->footCell($this->money(array_sum($ageing)))
            . '</tr></tfoot></table>';

        return $html;
    }

    /**
     * What the columns mean. ⚠️ Without this, "Due" and "Security held" look
     * like two separate debts — the retention is part of the due, and the
     * advance is the client's money, not BITAC's.
     */
    private function footNote(): string
    {
        return '<div style="margin-top: 10pt; font-size: 7.5pt; color: ' . self::MUTED . '; line-height: 1.5;">'
            . '<b>Security held</b> is money the client has withheld from a payment and has not yet returned — '
            . 'it is part of the Due, not additional to it. '
            . '<b>Advance in hand</b> is the client\'s money already received against a job that no bill has drawn on yet; '
            . '<b>Net receivable</b> is the Due less that advance. '
            . 'Income tax and VAT deducted at source are not shown as dues — they reach the treasury against a challan and settle the bill.'
            . '</div>'
            . '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 26pt;"><tr>'
            . '<td width="33%" style="font-size: 8.5pt;">'
            .   '<div style="border-top: 0.75pt solid ' . self::INK . '; padding-top: 3pt; width: 80%;">Prepared By</div></td>'
            . '<td width="34%" style="font-size: 8.5pt; text-align: center;">'
            .   '<div style="border-top: 0.75pt solid ' . self::INK . '; padding-top: 3pt; width: 80%; margin: 0 auto;">Accounts Officer</div></td>'
            . '<td width="33%" style="font-size: 8.5pt; text-align: right;">'
            .   '<div style="border-top: 0.75pt solid ' . self::INK . '; padding-top: 3pt; width: 80%; margin-left: auto;">Director (Centre Head)</div></td>'
            . '</tr></table>';
    }

    // ─────────────────────────────────────────────────────────────────────

    private function sectionHeading(string $text): string
    {
        return '<div style="font-size: 9pt; font-weight: bold; color: ' . self::INK . '; '
            . 'margin: 12pt 0 4pt;">' . $this->esc($text) . '</div>';
    }

    private function footCell(string $value, string $align = 'right'): string
    {
        return '<td style="border-top: 0.75pt solid ' . self::INK . '; padding: 4pt; text-align: ' . $align . '; '
            . 'font-weight: bold; font-size: 8pt; background: #f1f1f1;">' . $value . '</td>';
    }

    /**
     * ⚠️ No ৳ sign in the columns. The symbol is a Bangla-script glyph, so a
     * number carrying it is wrapped by mPDF's script detection and set in
     * Nikosh — which makes a column of figures sit at a different weight and
     * width from its neighbours. The unit is stated in the heading instead.
     */
    private function money(float $value): string
    {
        return number_format($value, 2);
    }

    private function esc(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
