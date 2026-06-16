<?php

namespace App\Services;

/**
 * Renders the BITAC official letter body (the part that sits inside the
 * letterhead) in Bangla or English. Shared by the quotation forwarding letter
 * and the standalone RFQ letters so the format stays identical everywhere.
 *
 * Layout:  Memo No. (top-left) / Date (top-right) → Subject → customer Ref →
 *          body → recipient (bottom-left) + signatory (bottom-right) with the
 *          "For / Director (Centre Head)" sign-off line.
 */
class OfficialLetterRenderer
{
    /**
     * @param array $d  Raw (un-escaped) fields:
     *   memoNo, issued (d/m/Y), subject, custRefNo, custRefDate (d/m/Y),
     *   recipientBlock (plain text), bodyHtml (already-safe HTML),
     *   signerName, signerDesignation, signerCenter, signerEmail, signerPhone,
     *   signatureImgHtml (already-safe HTML)
     */
    public function buildHtml(array $d, string $lang = 'bn'): string
    {
        $esc  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = ($lang !== 'en');

        $bnDigits = fn ($s) => strtr((string) $s, [
            '0' => '০', '1' => '১', '2' => '২', '3' => '৩', '4' => '৪',
            '5' => '৫', '6' => '৬', '7' => '৭', '8' => '৮', '9' => '৯',
        ]);
        $num = fn ($s) => $isBn ? $bnDigits($s) : (string) $s;

        $L = $isBn ? [
            'memo' => 'নং-', 'date' => 'তাং-', 'subject' => 'বিষয়ঃ-',
            'ref' => 'পত্র সূত্রঃ', 'refDate' => ', তারিখঃ',
            'yours' => 'আপনার বিশ্বস্ত', 'email' => 'ই-মেইলঃ', 'phone' => 'ফোনঃ',
            'for' => 'পক্ষে', 'director' => 'পরিচালক (কেন্দ্র প্রধান)',
        ] : [
            'memo' => 'Memo No.-', 'date' => 'Date-', 'subject' => 'Subject:-',
            'ref' => 'Ref:', 'refDate' => ', dated ',
            'yours' => 'Yours faithfully,', 'email' => 'Email:', 'phone' => 'Phone:',
            'for' => 'For', 'director' => 'Director (Centre Head),',
        ];
        $lf  = $isBn ? 'font-family: siyamrupali;' : '';
        $dot = $isBn ? '।' : '.';

        $memoOut   = $num($esc($d['memoNo'] ?? ''));
        $issuedOut = $num($d['issued'] ?? '');
        $subject   = $esc($d['subject'] ?? '');

        $custRefNo   = $esc($d['custRefNo'] ?? '');
        $custRefDate = $esc($d['custRefDate'] ?? '');
        $refSourceHtml = $custRefNo !== ''
            ? '<div style="' . $lf . ' margin-bottom: 8pt; font-size: 11pt; color: #000;">' . $L['ref'] . ' ' . $custRefNo . ($custRefDate !== '' ? $L['refDate'] . $custRefDate : '') . '.</div>'
            : '';

        $recipientCol = trim((string) ($d['recipientBlock'] ?? '')) !== ''
            ? '<div style="' . $lf . ' font-size: 11pt; color: #000; line-height: 1.5;">' . nl2br($esc($d['recipientBlock'])) . '</div>'
            : '';

        $signerName        = $esc($d['signerName'] ?? '');
        $signerDesignation = $esc($d['signerDesignation'] ?? '');
        $signerCenter      = $esc($d['signerCenter'] ?? '');
        $signerEmail       = $esc($d['signerEmail'] ?? '');
        $signerPhone       = $esc($d['signerPhone'] ?? '');
        $signatureImgHtml  = $d['signatureImgHtml'] ?? '<div style="height: 36pt;"></div>';

        $signerCol = '<div style="' . $lf . ' font-size: 11pt; color: #000; text-align: center;">'
            . '<div style="margin-bottom: 30pt;">' . $L['yours'] . '</div>'
            . '<div>' . $signatureImgHtml . '</div>'
            . '<div style="color: #a349a4;">(' . $signerName . ')</div>';
        if ($signerDesignation !== '') {
            $signerCol .= '<div style="color: #a349a4;">' . $signerDesignation . '</div>';
        }
        if ($signerCenter !== '') {
            $signerCol .= '<div style="color: #a349a4;">' . $signerCenter . $dot . '</div>';
        }
        if ($signerEmail !== '') {
            $signerCol .= '<div style="color: #a349a4;">' . $L['email'] . ' <u>' . $signerEmail . '</u></div>';
        }
        if ($signerPhone !== '') {
            $signerCol .= '<div style="color: #a349a4;">' . $L['phone'] . ' ' . $num($signerPhone) . '</div>';
        }
        $signerCol .= '<div style="margin-top: 6pt; color: #a349a4;">' . $L['for'] . '</div>'
            . '<div style="color: #a349a4;">' . $L['director'] . ' ' . $signerCenter . $dot . '</div>'
            . '</div>';

        $bodyHtml = $d['bodyHtml'] ?? '';

        return <<<HTML
<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 18pt;">
    <tr>
        <td style="{$lf} font-size: 11pt; color: #000; vertical-align: top;"><b>{$L['memo']}</b> {$memoOut}</td>
        <td style="{$lf} font-size: 11pt; color: #000; text-align: right; vertical-align: top;"><b>{$L['date']}</b> {$issuedOut}</td>
    </tr>
</table>
<div style="{$lf} margin-bottom: 8pt; font-size: 11pt; color: #000;"><b>{$L['subject']}</b> {$subject}</div>
{$refSourceHtml}
<div style="font-size: 11pt; color: #000; line-height: 1.7; text-align: justify; margin-top: 10pt;">
    {$bodyHtml}
</div>
<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 40pt;">
    <tr>
        <td width="48%" style="vertical-align: bottom;">{$recipientCol}</td>
        <td width="52%" style="vertical-align: top;">{$signerCol}</td>
    </tr>
</table>
HTML;
    }
}
