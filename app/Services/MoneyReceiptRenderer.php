<?php

namespace App\Services;

use App\Models\Center;
use App\Models\MoneyReceipt;
use App\Support\BanglaDigits;
use App\Support\BanglaWords;

/**
 * The money receipt as BITAC's printed receipt book has it (BITAC, 2026-11-01,
 * from receipt no. 84646): the centre's name and address, রশিদ নং / তারিখ,
 * "… এর নিকট হইতে / অত্র কেন্দ্রের … বাবদ নগদ/চেক নং … তারিখ … / মারফত …
 * টাকা … পয়সা কথায় … প্রাপ্তি স্বীকার করিয়া এই রশিদ দেওয়া গেল।", and the two
 * hand signatures — কোষাধ্যক্ষ and আয়ন ও ব্যয়ন কর্মকর্তা.
 *
 * One A4 sheet carries two copies — the payer's and the office's — with a
 * line to cut along, as the book has a counterfoil. It is a form of its own,
 * not the letterhead pad, so it goes through renderPlain().
 */
class MoneyReceiptRenderer
{
    public function render(MoneyReceipt $receipt): string
    {
        $receipt->loadMissing('customer');
        $center = Center::find($receipt->center_id) ?? Center::find(Center::defaultId());

        $copy = fn (string $label) => $this->copy($receipt, $center, $label);
        $html = $copy('প্রাপকের কপি')
            . '<div style="border-top: 0.75pt dashed #9ca3af; margin: 9mm 0 8mm; text-align: center;">'
            . '<span class="bn" style="font-family: nikosh; font-size: 8pt; color: #9ca3af;">কেটে নিন</span></div>'
            . $copy('অফিস কপি');

        return app(BitacLetterhead::class)->renderPlain($html, "Money Receipt {$receipt->receipt_no}", [210, 297], marginMm: 12);
    }

    private function copy(MoneyReceipt $r, ?Center $center, string $copyLabel): string
    {
        $e  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $bn = fn ($v) => BanglaDigits::from((string) $v);
        // What was filled in on the form — set apart from the printed words, as handwriting is.
        // Latin in the Bangla line is set in Tinos a size down, or it towers over the Nikosh around it.
        $val = fn (string $v) => '<b style="color: #1e3a8a;">'
            . preg_replace('/(?<![&#\w])[A-Za-z][A-Za-z0-9 .,()\-\/]*/', '<span style="font-family: tinos; font-size: 10.5pt;">$0</span>', $v)
            . '</b>';
        $gap = '<span style="color: #9ca3af;">……………</span>';

        $taka  = (int) floor((float) $r->amount);
        $paisa = (int) round(((float) $r->amount - $taka) * 100);

        $cheque = $r->method === 'cheque'
            ? 'চেক নং ' . ($r->cheque_no ? $val($e($r->cheque_no)) : $gap) . ' তারিখ ' . ($r->cheque_date ? $val($bn($r->cheque_date->format('d/m/Y'))) : $gap)
                . ($r->bank_name ? ' (' . $val($e($r->bank_name)) . ')' : '')
            : $val('নগদ');

        $name    = $e($center?->name_bn ?: 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)');
        $address = $e($center?->address_bn ?: '');
        $phone   = $e($center?->phone_bn ?: '');

        $line = 'font-size: 12pt; line-height: 2.1; color: #111;';

        return '<div class="bn" style="font-family: nikosh; border: 0.75pt solid #6b7280; padding: 6mm 7mm; position: relative;">'
            // Top: number and the copy left, the phone right.
            . '<table width="100%" cellspacing="0" cellpadding="0"><tr>'
            .   '<td style="font-size: 11pt; vertical-align: top;">রশিদ নং- ' . $val($bn($e($r->receipt_no))) . '</td>'
            .   '<td style="font-size: 9pt; text-align: right; vertical-align: top; color: #374151;">'
            .     ($phone !== '' ? 'আলাপনী- ' . $phone . '<br>' : '')
            .     '<span style="border: 0.5pt solid #6b7280; padding: 0.5pt 4pt;">' . $copyLabel . '</span>'
            .   '</td>'
            . '</tr></table>'
            // The centre.
            . '<div style="text-align: center; margin-top: 1mm;">'
            .   '<div style="font-size: 17pt; font-weight: bold; color: #111;">' . $name . '</div>'
            .   ($address !== '' ? '<div style="font-size: 10pt; color: #374151;">' . $address . '</div>' : '')
            .   '<div style="font-size: 12pt; font-weight: bold; margin-top: 1.5mm;">মানি রশিদ</div>'
            . '</div>'
            . '<div style="text-align: right; font-size: 11pt; margin-top: 1mm;">তারিখ ' . $val($bn($r->receipt_date->format('d/m/Y'))) . '</div>'
            // The body, in the book's own words.
            . '<div style="' . $line . ' margin-top: 2mm;">'
            .   $val($e($r->payer_name)) . ' এর নিকট হইতে'
            .   '<br>অত্র কেন্দ্রের ' . $val($e($r->purpose)) . ' বাবদ ' . $cheque
            .   '<br>মারফত ' . ($r->received_through ? $val($e($r->received_through)) . ' ' : '')
            .     $val('=' . $bn(self::indian($taka)) . '/-') . ' টাকা ' . $val($bn(str_pad((string) $paisa, 2, '0', STR_PAD_LEFT))) . ' পয়সা'
            .   ' কথায় ' . $val(BanglaWords::taka((float) $r->amount))
            .   ' প্রাপ্তি স্বীকার করিয়া এই রশিদ দেওয়া গেল।'
            . '</div>'
            . ($r->details ? '<div style="font-size: 10pt; color: #374151; margin-top: 1mm;">বিবরণ: ' . $val($e($r->details)) . '</div>' : '')
            . ($r->isCancelled()
                ? '<div style="margin-top: 2mm; text-align: center; font-size: 16pt; font-weight: bold; color: #b91c1c; border: 1pt solid #b91c1c; padding: 1mm;">বাতিল (CANCELLED)'
                    . ($r->cancel_reason ? '<div style="font-size: 9pt; font-weight: normal;">' . $e($r->cancel_reason) . '</div>' : '') . '</div>'
                : '')
            // The two hand signatures. ⚠️ Rules are table-cell borders in their own row.
            . '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 14mm; border-collapse: collapse;"><tr>'
            .   '<td width="34%" style="border-top: 0.75pt solid #000; padding-top: 2pt; text-align: center; font-size: 11pt;">কোষাধ্যক্ষ</td>'
            .   '<td width="32%"></td>'
            .   '<td width="34%" style="border-top: 0.75pt solid #000; padding-top: 2pt; text-align: center; font-size: 11pt;">আয়ন ও ব্যয়ন কর্মকর্তা</td>'
            . '</tr></table>'
            . '</div>';
    }

    /** 1234567 → "12,34,567", the way taka is written. */
    public static function indian(int $n): string
    {
        $s = (string) $n;
        if (strlen($s) <= 3) return $s;
        $last = substr($s, -3);
        $rest = substr($s, 0, -3);

        return preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest) . ',' . $last;
    }
}
