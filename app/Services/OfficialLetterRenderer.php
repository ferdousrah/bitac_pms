<?php

namespace App\Services;

use App\Support\BanglaDigits;
use App\Support\SignatureBlock;

/**
 * Renders the BITAC official letter body (the part that sits inside the
 * letterhead) in Bangla or English. Shared by the quotation forwarding letter
 * and the standalone RFQ letters so the format stays identical everywhere.
 *
 * Layout:  Ref No. (top-left) / Date (top-right) → Subject → customer Ref →
 *          body → recipient (bottom-left) + signatory (bottom-right). Signed →
 *          the signature image alone; unsigned → "Yours faithfully", the typed
 *          lines and the "For / Director (Centre Head)" sign-off.
 */
class OfficialLetterRenderer
{
    /**
     * @param array $d  Raw (un-escaped) fields:
     *   memoNo, issued (d/m/Y), subject, custRefNo, custRefDate (d/m/Y),
     *   recipientBlock (plain text), bodyHtml (already-safe HTML),
     *   signerName, signerDesignation, signerCenter, signerEmail, signerPhone,
     *   signaturePath (absolute local path of the signature image, or null)
     */
    public function buildHtml(array $d, string $lang = 'bn'): string
    {
        $esc  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = ($lang !== 'en');

        $num = fn ($s) => $isBn ? BanglaDigits::from($s) : (string) $s;

        $L = $isBn ? [
            'memo' => 'নং-', 'date' => 'তাং-', 'subject' => 'বিষয়ঃ-',
            'ref' => 'পত্র সূত্রঃ', 'refDate' => ', তারিখঃ',
            'yours' => 'আপনার বিশ্বস্ত', 'email' => 'ই-মেইলঃ', 'phone' => 'ফোনঃ',
            'for' => 'পক্ষে', 'director' => 'পরিচালক (কেন্দ্র প্রধান)',
        ] : [
            'memo' => 'Ref No.-', 'date' => 'Date-', 'subject' => 'Subject:-',
            'ref' => 'Ref:', 'refDate' => ', dated ',
            'yours' => 'Yours faithfully,', 'email' => 'Email:', 'phone' => 'Phone:',
            'for' => 'For', 'director' => 'Director (Centre Head),',
        ];
        $lf  = $isBn ? 'font-family: nikosh;' : '';
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
        // `signaturePath` is the image the letter is signed with (an absolute
        // local path, or null when nobody has signed yet).
        $signaturePath = $d['signaturePath'] ?? null;

        // The scan already carries the name, designation, centre and contacts
        // under the pen stroke, so a signed letter prints the image alone. An
        // UNSIGNED one keeps the typed lines, or it would name nobody.
        $typedLines = [
            '(' . $signerName . ')',
            $signerDesignation,
            $signerCenter !== '' ? $signerCenter . $dot : '',
            $signerEmail !== '' ? $L['email'] . ' <u>' . $signerEmail . '</u>' : '',
            $signerPhone !== '' ? $L['phone'] . ' ' . $num($signerPhone) : '',
        ];

        // ⚠️ A signed letter prints the image and NOTHING around it. The scan
        // is the whole block BITAC's officers sign with, so a typed "Yours
        // faithfully," above it and "For — Director (Centre Head)" under it
        // only repeated what the officer's own block already says. The
        // UNSIGNED letter keeps both, with the typed lines between them, so it
        // still reads as a complete sign-off.
        $isSigned = $signaturePath && is_file($signaturePath);

        // Right-aligned: on the printed BITAC letter the signature block sits
        // against the right margin, not floating in the middle of its column.
        $signerCol = '<div style="' . $lf . ' font-size: 11pt; color: #000; text-align: right;">'
            . ($isSigned ? '' : '<div style="margin-bottom: 30pt;">' . $L['yours'] . '</div>')
            . SignatureBlock::html($signaturePath, $typedLines, blankHeightPt: 46, imageMaxWidthPt: 190, align: 'right')
            . ($isSigned ? '' :
                '<div style="margin-top: 6pt; color: #a349a4;">' . $L['for'] . '</div>'
                . '<div style="color: #a349a4;">' . $L['director'] . ' ' . $signerCenter . $dot . '</div>')
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
<div class="letter-body" style="font-size: 11pt; color: #000; line-height: 1.7; text-align: justify; margin-top: 10pt;">
    {$bodyHtml}
</div>
<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 40pt;">
    <tr>
        <td width="48%" style="vertical-align: bottom;">{$recipientCol}</td>
        <td width="52%" align="right" style="vertical-align: top; text-align: right;">{$signerCol}</td>
    </tr>
</table>
HTML;
    }
}
