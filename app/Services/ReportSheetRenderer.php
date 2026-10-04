<?php

namespace App\Services;

/**
 * Every report, printed on the BITAC pad from one description of a sheet.
 *
 * A report is a title, a line saying what was asked for, some headline
 * figures, one or more tables and a note. Nine of them differ only in those
 * contents, so they describe a sheet and this renders it — rather than nine
 * copies of the same table CSS drifting apart.
 *
 * ⚠️ **Callers hand in finished strings, never numbers.** A report decides how
 * its own figures read (a dash for "not applicable", a percentage, a date);
 * this only lays them out. `money()` is here so they all round and group the
 * same way.
 *
 * ⚠️ **No ৳ sign inside a figure column.** The symbol is Bengali script, so
 * mPDF's `autoScriptToLang` wraps any number carrying it in `.lang_bn` and
 * sets it in Nikosh — that column then sits at a different weight and width
 * from its neighbours. State the unit once in the subtitle instead; `money()`
 * deliberately does not add one.
 *
 * ⚠️ **Landscape is not cosmetic.** Past about six columns a figure wraps, and
 * a wrapped figure cannot be read down a column. `landscape` is passed to
 * BitacLetterhead::render() as an mPDF override; the letterhead block is laid
 * out in percentages, so it follows the wider page.
 */
class ReportSheetRenderer
{
    private const INK   = '#111';
    private const MUTED = '#555';
    private const RULE  = '#999';
    private const BAND  = '#f1f1f1';
    private const ZEBRA = '#fafafa';

    /**
     * @param array{
     *   title_en: string,
     *   title_bn?: ?string,
     *   subtitle?: ?string,
     *   landscape?: bool,
     *   tiles?: array<int,array{label:string,value:string}>,
     *   sections?: array<int,array{
     *     heading?: ?string,
     *     caption?: ?string,
     *     columns: array<int,array{label:string,align?:string,width?:string}>,
     *     rows: array<int,array<int,string>>,
     *     total?: ?array<int,string>,
     *     empty?: ?string
     *   }>,
     *   notes?: ?string,
     *   signatories?: array<int,string>
     * } $sheet
     */
    public function render(array $sheet): string
    {
        $landscape = (bool) ($sheet['landscape'] ?? false);

        $body = $this->titleBlock($sheet)
            . $this->tilesBlock($sheet['tiles'] ?? [])
            . $this->sectionsBlock($sheet['sections'] ?? [])
            . $this->notesBlock($sheet['notes'] ?? null)
            . $this->signatureBlock($sheet['signatories'] ?? []);

        return app(BitacLetterhead::class)->render(
            $body,
            $sheet['title_en'] . ' ' . now()->format('d-m-Y'),
            null,
            'bn',
            $landscape ? ['format' => 'A4-L'] : [],
        );
    }

    /** Figures group and round the same way on every sheet. No currency sign. */
    public static function money(float|int|string|null $value, int $decimals = 2): string
    {
        return number_format((float) $value, $decimals);
    }

    /** An empty cell reads as a dash, so a blank is never mistaken for a zero. */
    public static function dash(float|int|string|null $value, ?string $formatted = null): string
    {
        if ($value === null || $value === '' || (is_numeric($value) && (float) $value == 0.0)) {
            return '—';
        }

        return $formatted ?? (string) $value;
    }

    // ─────────────────────────────────────────────────────────────────────

    private function titleBlock(array $sheet): string
    {
        $html = '<div style="text-align: center; margin-bottom: 10pt;">';

        if (! empty($sheet['title_bn'])) {
            $html .= '<div class="bn" style="font-size: 14pt; font-weight: bold; color: ' . self::INK . ';">'
                . $this->esc($sheet['title_bn']) . '</div>';
        }

        $html .= '<div style="font-size: ' . (empty($sheet['title_bn']) ? '14pt' : '11pt')
            . '; font-weight: bold; letter-spacing: 0.5pt; color: ' . self::INK . ';">'
            . ($sheet['title_bn'] ? '(' . $this->esc($sheet['title_en']) . ')' : $this->esc($sheet['title_en']))
            . '</div>';

        if (! empty($sheet['subtitle'])) {
            $html .= '<div style="font-size: 8.5pt; color: ' . self::MUTED . '; margin-top: 3pt;">'
                . $sheet['subtitle'] . '</div>';
        }

        return $html . '</div>';
    }

    /** The figures a manager reads first, in one even row. */
    private function tilesBlock(array $tiles): string
    {
        if ($tiles === []) {
            return '';
        }

        $width = round(100 / count($tiles), 4);

        $html = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt;"><tr>';
        foreach ($tiles as $tile) {
            $html .= '<td style="width: ' . $width . '%; border: 0.5pt solid ' . self::RULE . '; padding: 5pt 4pt; text-align: center;">'
                . '<div style="font-size: 7pt; color: ' . self::MUTED . '; text-transform: uppercase; letter-spacing: 0.4pt;">'
                . $this->esc($tile['label']) . '</div>'
                . '<div style="font-size: 10.5pt; font-weight: bold; color: ' . (($tile['ink'] ?? null) ?: self::INK) . '; margin-top: 2pt;">'
                . $tile['value'] . '</div>'
                . '</td>';
        }

        return $html . '</tr></table>';
    }

    private function sectionsBlock(array $sections): string
    {
        $html = '';

        foreach ($sections as $section) {
            if (! empty($section['heading'])) {
                $html .= '<div style="font-size: 9pt; font-weight: bold; color: ' . self::INK . '; margin: 12pt 0 2pt;">'
                    . $this->esc($section['heading']) . '</div>';
            }
            if (! empty($section['caption'])) {
                $html .= '<div style="font-size: 7.5pt; color: ' . self::MUTED . '; margin-bottom: 4pt;">'
                    . $section['caption'] . '</div>';
            }

            $html .= $this->table($section);
        }

        return $html;
    }

    private function table(array $section): string
    {
        $columns = $section['columns'];
        $rows    = $section['rows'] ?? [];

        $html = '<table width="100%" cellspacing="0" cellpadding="0" style="font-size: 8pt; border: 0.5pt solid '
            . self::RULE . ';"><thead><tr>';

        foreach ($columns as $column) {
            $html .= '<th' . (isset($column['width']) ? ' width="' . $column['width'] . '"' : '')
                . ' style="border-bottom: 0.75pt solid ' . self::INK . '; padding: 4pt; font-size: 7.5pt;'
                . ' text-align: ' . ($column['align'] ?? 'left') . '; background: ' . self::BAND
                . '; color: ' . self::INK . ';">' . $this->esc($column['label']) . '</th>';
        }
        $html .= '</tr></thead><tbody>';

        if ($rows === []) {
            $html .= '<tr><td colspan="' . count($columns) . '" style="padding: 10pt; text-align: center; color: '
                . self::MUTED . ';">' . $this->esc($section['empty'] ?? 'Nothing to show.') . '</td></tr>';
        }

        foreach ($rows as $i => $row) {
            // A light band every other row; a wide figure table is misread
            // across the line otherwise.
            $bg = $i % 2 ? ' background: ' . self::ZEBRA . ';' : '';

            $html .= '<tr>';
            foreach (array_values($row) as $c => $cell) {
                $html .= '<td style="border-bottom: 0.25pt solid #ddd; padding: 3pt 4pt; text-align: '
                    . ($columns[$c]['align'] ?? 'left') . ';' . $bg . '">' . $cell . '</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody>';

        if (! empty($section['total'])) {
            $html .= '<tfoot><tr>';
            foreach (array_values($section['total']) as $c => $cell) {
                $html .= '<td style="border-top: 0.75pt solid ' . self::INK . '; padding: 4pt; font-weight: bold;'
                    . ' font-size: 8pt; background: ' . self::BAND . '; text-align: '
                    . ($columns[$c]['align'] ?? 'left') . ';">' . $cell . '</td>';
            }
            $html .= '</tr></tfoot>';
        }

        return $html . '</table>';
    }

    private function notesBlock(?string $notes): string
    {
        if (! $notes) {
            return '';
        }

        return '<div style="margin-top: 10pt; font-size: 7.5pt; color: ' . self::MUTED . '; line-height: 1.5;">'
            . $notes . '</div>';
    }

    private function signatureBlock(array $signatories): string
    {
        if ($signatories === []) {
            return '';
        }

        $width = round(100 / count($signatories), 4);
        $last  = count($signatories) - 1;

        $html = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 26pt;"><tr>';
        foreach ($signatories as $i => $name) {
            $align = $i === 0 ? 'left' : ($i === $last ? 'right' : 'center');
            $margin = $i === 0 ? '' : ($i === $last ? 'margin-left: auto;' : 'margin: 0 auto;');

            $html .= '<td width="' . $width . '%" style="font-size: 8.5pt; text-align: ' . $align . ';">'
                . '<div style="border-top: 0.75pt solid ' . self::INK . '; padding-top: 3pt; width: 80%; ' . $margin . '">'
                . $this->esc($name) . '</div></td>';
        }

        return $html . '</tr></table>';
    }

    private function esc(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
