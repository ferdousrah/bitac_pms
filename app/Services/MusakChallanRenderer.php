<?php

namespace App\Services;

use App\Models\MusakChallan;
use App\Support\BanglaDigits;

/**
 * মূসক ৬.৩ — কর চালানপত্র.
 *
 * ⚠️ **This is an NBR form, not BITAC stationery.** It carries its own masthead
 * (গণপ্রজাতন্ত্রী বাংলাদেশ সরকার / জাতীয় রাজস্ব বোর্ড) and must NOT be printed on
 * the BITAC letterhead — so it goes through `BitacLetterhead::renderPlain()`,
 * which gives the Tinos/Nikosh font setup and Bangla shaping without the pad.
 *
 * The layout is transcribed from an original BITAC issued (challan no. 45), so
 * nothing here is invented: eleven numbered columns, a সর্বমোট row totalling
 * ৬ / ১০ / ১১, the signatory block, the seal box, and the footnote.
 *
 * Every figure comes off the stored row. Nothing is recalculated at print time —
 * a tax document prints what it was issued with.
 */
class MusakChallanRenderer
{
    /** প্রথম / দ্বিতীয় / তৃতীয় কপি — the copy label is a variable on the form. */
    private const COPY_LABELS = [1 => 'প্রথম কপি', 2 => 'দ্বিতীয় কপি', 3 => 'তৃতীয় কপি'];

    private const COLUMNS = [
        'ক্রমিক নং',
        'পণ্য বা সেবার বর্ণনা (প্রযোজ্য ক্ষেত্রে ব্র্যান্ড নাম সহ)',
        'সরবরাহের একক',
        'পরিমাণ',
        'একক মূল্য (টাকায়)',
        'মোট মূল্য (টাকায়)',
        'সম্পূরক শুল্কের হার',
        'সম্পূরক শুল্কের পরিমাণ (টাকায়)',
        'মূল্য সংযোজন করহার / সুনির্দিষ্ট কর',
        'মূল্য সংযোজন কর / সুনির্দিষ্ট কর এর পরিমাণ (টাকায়)',
        'সকল প্রকার শুল্ক ও করসহ মূল্য',
    ];

    /** Percentage widths, summing to 100 — column ২ carries the description. */
    private const WIDTHS = [4, 22, 7, 7, 9, 10, 7, 9, 8, 9, 8];

    public function render(MusakChallan $challan, int $copy = 1): string
    {
        $challan->loadMissing(['items', 'signatory']);

        return app(BitacLetterhead::class)->renderPlain(
            $this->buildHtml($challan, $copy),
            'মূসক ৬.৩',
            BitacLetterhead::LEGAL_MM,
            marginMm: 10,
        );
    }

    private function buildHtml(MusakChallan $challan, int $copy): string
    {
        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $bn  = fn ($v) => BanglaDigits::from((string) $v);
        // ⚠️ The column figures are WHOLE TAKA, as on the printed form — the
        // original reads 290,909 + 29,091 = 320,000, with no paisa anywhere.
        $money = fn ($v) => BanglaDigits::from(number_format((float) $v));
        // The unit price is the exception: it is a per-piece price, not a
        // total, so it keeps its paisa when it has any.
        $price = fn ($v) => BanglaDigits::from(
            fmod((float) $v, 1.0) === 0.0 ? number_format((float) $v) : number_format((float) $v, 2)
        );

        $cell = 'border: 0.75pt solid #000; padding: 3pt 4pt; font-family: nikosh;';

        return '<div style="font-family: nikosh; font-size: 9pt; color: #000;">'
            . $this->masthead($challan, $copy, $esc, $bn)
            . $this->header($challan, $esc, $bn)
            . $this->table($challan, $esc, $bn, $money, $price, $cell)
            . $this->footer($challan, $esc)
            . '</div>';
    }

    private function masthead(MusakChallan $challan, int $copy, callable $esc, callable $bn): string
    {
        $label = self::COPY_LABELS[$copy] ?? self::COPY_LABELS[1];

        return '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt;">'
            . '<tr>'
            .   '<td width="22%"></td>'
            .   '<td width="56%" align="center" style="font-family: nikosh; line-height: 1.5;">'
            .     '<div style="font-size: 11pt;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>'
            .     '<div style="font-size: 11pt;">জাতীয় রাজস্ব বোর্ড</div>'
            .     '<div style="font-size: 13pt; font-weight: bold; margin-top: 3pt;">কর চালানপত্র</div>'
            .     '<div style="font-size: 8pt; margin-top: 1pt;">[বিধি ৪০ এর উপ-বিধি (১) এর দফা (গ) ও (চ) দ্রষ্টব্য]</div>'
            .   '</td>'
            .   '<td width="22%" align="right" style="vertical-align: top;">'
            .     '<table cellspacing="0" cellpadding="0" style="border: 0.75pt solid #000;">'
            .       '<tr><td style="border-bottom: 0.75pt solid #000; padding: 2pt 8pt; font-family: nikosh; font-size: 9pt; text-align: center;">'
            .         $label . '</td></tr>'
            .       '<tr><td style="padding: 2pt 8pt; font-family: nikosh; font-size: 9pt; text-align: center;">মূসক-৬.৩</td></tr>'
            .     '</table>'
            .   '</td>'
            . '</tr></table>';
    }

    /** Supplier + buyer on the left, the challan's own identity on the right. */
    private function header(MusakChallan $challan, callable $esc, callable $bn): string
    {
        $line = fn (string $label, $value, bool $block = false) =>
            '<tr>'
            . '<td style="font-family: nikosh; padding: 1.5pt 0; vertical-align: top; white-space: nowrap;">' . $label . '</td>'
            . '<td style="padding: 1.5pt 4pt; vertical-align: top;">:</td>'
            . '<td style="font-family: nikosh; padding: 1.5pt 0; vertical-align: top;">'
            .   ($block ? nl2br($esc($value)) : $esc($value)) . '</td>'
            . '</tr>';

        $left = '<table width="100%" cellspacing="0" cellpadding="0" style="font-size: 9pt;">'
            . $line('নিবন্ধিত ব্যক্তির নাম', $challan->supplier_name)
            . $line('নিবন্ধিত ব্যক্তির বিআইএন', $challan->supplier_bin ? $bn($challan->supplier_bin) : '')
            . $line('চালানপত্র ইস্যুর ঠিকানা', $challan->supplier_address, true)
            . $line('ক্রেতার নাম', $challan->buyer_name)
            . $line('ক্রেতার বিআইএন (প্রযোজ্য ক্ষেত্রে)', $challan->buyer_bin ? $bn($challan->buyer_bin) : '')
            . $line('ক্রেতার ঠিকানা', $challan->buyer_address, true)
            . $line('সরবরাহের গন্তব্যস্থল', $challan->destination, true)
            . $line('যানবাহনের প্রকৃতি ও নম্বর', $challan->vehicle)
            . '</table>';

        $time = $challan->issue_time ? substr((string) $challan->issue_time, 0, 5) : '';
        $right = '<table width="100%" cellspacing="0" cellpadding="0" style="font-size: 9pt;">'
            . $line('চালানপত্র নম্বর', $challan->challan_no ? $bn($challan->challan_no) : '')
            . $line('ইস্যুর তারিখ', $challan->issue_date ? $bn($challan->issue_date->format('d/m/Y')) : '')
            . $line('ইস্যুর সময়', $time ? $bn($time) : '')
            . '</table>';

        return '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 6pt;">'
            . '<tr>'
            .   '<td width="62%" style="vertical-align: top;">' . $left . '</td>'
            .   '<td width="38%" style="vertical-align: top; padding-left: 10pt;">' . $right . '</td>'
            . '</tr></table>';
    }

    private function table(MusakChallan $challan, callable $esc, callable $bn, callable $money, callable $price, string $cell): string
    {
        $head = '<tr>';
        foreach (self::COLUMNS as $i => $label) {
            $head .= '<td width="' . self::WIDTHS[$i] . '%" align="center" style="' . $cell
                . ' font-size: 7.5pt; font-weight: bold; vertical-align: middle;">' . $label . '</td>';
        }
        $head .= '</tr><tr>';
        foreach (self::COLUMNS as $i => $label) {
            $head .= '<td align="center" style="' . $cell . ' font-size: 8pt;">' . $bn($i + 1) . '</td>';
        }
        $head .= '</tr>';

        $body = '';
        foreach ($challan->items as $i => $item) {
            $body .= '<tr>'
                . '<td align="center" style="' . $cell . '">' . $bn($i + 1) . '</td>'
                . '<td style="' . $cell . '">' . nl2br($esc($item->description)) . '</td>'
                . '<td align="center" style="' . $cell . '">' . $esc($item->unit) . '</td>'
                . '<td align="center" style="' . $cell . '">' . $bn(rtrim(rtrim(number_format((float) $item->quantity, 3), '0'), '.')) . '</td>'
                . '<td align="right" style="' . $cell . '">' . $price($item->unit_price) . '</td>'
                . '<td align="right" style="' . $cell . '">' . $money($item->total_value) . '</td>'
                . '<td align="center" style="' . $cell . '">' . ((float) $item->sd_rate > 0 ? $bn(rtrim(rtrim(number_format((float) $item->sd_rate, 2), '0'), '.')) . '%' : '-') . '</td>'
                . '<td align="right" style="' . $cell . '">' . ((float) $item->sd_amount > 0 ? $money($item->sd_amount) : '-') . '</td>'
                . '<td align="center" style="' . $cell . '">' . $bn(rtrim(rtrim(number_format((float) $item->vat_rate, 2), '0'), '.')) . '%</td>'
                . '<td align="right" style="' . $cell . '">' . $money($item->vat_amount) . '</td>'
                . '<td align="right" style="' . $cell . '">' . $money($item->total_inclusive) . '</td>'
                . '</tr>';
        }

        // সর্বমোট totals columns ৬, ১০ and ১১ — and only those, as on the form.
        $total = '<tr>'
            . '<td colspan="5" align="right" style="' . $cell . ' font-weight: bold;">সর্বমোট</td>'
            . '<td align="right" style="' . $cell . ' font-weight: bold;">' . $money($challan->total_value) . '</td>'
            . '<td style="' . $cell . '"></td>'
            . '<td align="right" style="' . $cell . '">' . ((float) $challan->total_sd > 0 ? $money($challan->total_sd) : '') . '</td>'
            . '<td style="' . $cell . '"></td>'
            . '<td align="right" style="' . $cell . ' font-weight: bold;">' . $money($challan->total_vat) . '</td>'
            . '<td align="right" style="' . $cell . ' font-weight: bold;">' . $money($challan->total_inclusive) . '</td>'
            . '</tr>';

        return '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 8.5pt;">'
            . $head . $body . $total . '</table>';
    }

    private function footer(MusakChallan $challan, callable $esc): string
    {
        $signer = $challan->signatory;
        $sigPath = $challan->signature_path
            ? \Storage::disk('public')->path($challan->signature_path)
            : $signer?->signatureAbsolutePath();
        $sigPath = ($sigPath && is_file($sigPath)) ? $sigPath : null;

        $image = $sigPath
            ? '<img src="' . $sigPath . '" style="max-width: 150pt;">'
            : '<div style="height: 34pt;"></div>';

        $row = fn (string $label, string $value) =>
            '<tr>'
            . '<td style="font-family: nikosh; padding: 1.5pt 0; white-space: nowrap;">' . $label . '</td>'
            . '<td style="padding: 1.5pt 4pt;">:</td>'
            . '<td style="font-family: nikosh; padding: 1.5pt 0;">' . $value . '</td>'
            . '</tr>';

        $block = '<table cellspacing="0" cellpadding="0" style="font-size: 9pt;">'
            . $row('প্রতিষ্ঠান কর্তৃপক্ষের দায়িত্বপ্রাপ্ত ব্যক্তির নাম', $esc($signer?->name))
            . $row('পদবি', $esc($signer?->designation))
            . '</table>'
            . '<div style="margin-top: 4pt; font-family: nikosh; font-size: 9pt;">স্বাক্ষর</div>'
            . '<div style="margin-top: 2pt;">' . $image . '</div>';

        $seal = '<table cellspacing="0" cellpadding="0" style="border: 0.75pt solid #000; width: 110pt; height: 70pt;">'
            . '<tr><td align="center" style="font-family: nikosh; font-size: 9pt; vertical-align: middle;">সীল</td></tr>'
            . '</table>';

        return '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 10pt;">'
            . '<tr>'
            .   '<td width="70%" style="vertical-align: top;">' . $block . '</td>'
            .   '<td width="30%" align="right" style="vertical-align: top;">' . $seal . '</td>'
            . '</tr></table>'
            . '<div style="margin-top: 8pt; font-family: nikosh; font-size: 8.5pt;">সকল প্রকার কর ব্যতীত মূল্য</div>'
            . (trim((string) $challan->note) !== ''
                ? '<div style="margin-top: 4pt; font-family: nikosh; font-size: 8.5pt;">' . nl2br($esc($challan->note)) . '</div>'
                : '');
    }
}
