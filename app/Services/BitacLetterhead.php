<?php

namespace App\Services;

use App\Models\Center;
use Mpdf\Mpdf;
use Mpdf\HTMLParserMode;

/**
 * BITAC Official Letterhead — produces letterhead-styled PDFs via mPDF.
 *
 * Every BITAC center can have its own letterhead (Bangla name, ministry tag,
 * address, contact info, logos). The Center model stores those fields; this
 * service renders a PDF using whatever the active/passed-in center provides.
 *
 * Why mPDF and not DomPDF?
 *   DomPDF lacks Indic complex-script shaping, so Bangla যুক্তাক্ষর + matra
 *   placement renders incorrectly. mPDF has native Indic support.
 *
 * Bangla font (Siyam Rupali) is loaded from public/fonts/SiyamRupali.ttf.
 */
class BitacLetterhead
{
    /**
     * Render a full letterhead PDF and return the binary bytes.
     *
     * @param string       $bodyHtml      Inner document content (already styled inline).
     * @param string       $documentTitle Sets PDF metadata title.
     * @param Center|null  $center        Center whose letterhead to use. Falls back
     *                                    to session active center, then Dhaka (id 1).
     * @param string       $language      'bn' (default — Bangla/bilingual letterhead) or
     *                                    'en' (English-only — for foreign clients).
     */
    public function render(string $bodyHtml, string $documentTitle = 'BITAC PMS Document', ?Center $center = null, string $language = 'bn'): string
    {
        $center   = $this->resolveCenter($center);
        $language = in_array($language, ['bn', 'en'], true) ? $language : 'bn';
        $mpdf     = $this->buildMpdf($documentTitle);

        // Faded BITAC logo watermark — makes the rendered page look like a
        // preprinted letterhead pad. Use the BITAC gear logo (right-side logo
        // in the header). Falls back to the left logo if the right one is
        // missing, then skips silently if neither exists.
        $watermark = $center?->logoRightAbsolutePath() ?: $center?->logoLeftAbsolutePath();
        if ($watermark && is_file($watermark)) {
            // Args: (file, alpha 0..1, size — [w, h] in mm for big visible mark,
            // position — 'P' = centered on page)
            $mpdf->SetWatermarkImage($watermark, 0.04, [160, 160], 'P');
            $mpdf->showWatermarkImage = true;
        }

        $mpdf->SetHTMLHeader($this->headerHtml($center, $language));
        $mpdf->SetHTMLFooter($this->footerHtml($center, $language));

        $mpdf->WriteHTML($this->stylesheetCss(), HTMLParserMode::HEADER_CSS);
        $mpdf->WriteHTML($bodyHtml, HTMLParserMode::HTML_BODY);

        return $mpdf->Output('', \Mpdf\Output\Destination::STRING_RETURN);
    }

    /**
     * Find which center's letterhead to use:
     *   1. Explicit $center argument wins.
     *   2. Otherwise, session active_center_id (set by SetActiveCenter middleware).
     *   3. Otherwise, the first center (Dhaka HQ).
     */
    private function resolveCenter(?Center $center): ?Center
    {
        if ($center) return $center;

        $activeId = session('active_center_id') ?? auth()->user()?->center_id ?? 1;
        return Center::find($activeId) ?? Center::first();
    }

    /**
     * Configure mPDF with our font dir + register SiyamRupali for Bangla shaping.
     */
    private function buildMpdf(string $title): Mpdf
    {
        $defaultConfig     = (new \Mpdf\Config\ConfigVariables())->getDefaults();
        $fontDirs          = $defaultConfig['fontDir'];
        $defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
        $fontData          = $defaultFontConfig['fontdata'];

        // mPDF's default tempDir (vendor/mpdf/mpdf/tmp) isn't writable by Apache
        // in the Docker container. Point it at our writable storage location.
        $tempDir = storage_path('framework/mpdf');
        if (!is_dir($tempDir)) {
            @mkdir($tempDir, 0775, true);
        }

        $mpdf = new Mpdf([
            'mode'             => 'utf-8',
            'format'           => 'A4',
            'tempDir'          => $tempDir,
            'margin_left'      => 18,
            'margin_right'     => 18,
            'margin_top'       => 44,    // clears the five-line letterhead + logos
            'margin_bottom'    => 14,    // footer is only the page number now
            'margin_header'    => 6,
            'margin_footer'    => 8,
            'fontDir'          => array_merge($fontDirs, [
                public_path('fonts'),
            ]),
            'fontdata'         => $fontData + [
                'siyamrupali' => [
                    'R' => 'SiyamRupali.ttf',
                ],
            ],
            'default_font'        => 'dejavusans',
            'autoScriptToLang'    => true,
            'autoLangToFont'      => true,
            'useSubstitutions'    => true,
        ]);

        $mpdf->SetTitle($title);
        $mpdf->SetCreator('BITAC PMS');
        $mpdf->SetAuthor('BITAC');

        return $mpdf;
    }

    /**
     * Ink colours of the printed BITAC letterhead. These are fixed features
     * of the official stationery, not per-centre branding. The rule beneath
     * the block uses the centre's own `letterhead_color`.
     */
    private const TITLE_INK    = '#5b2d90';  // deep violet — centre name
    private const MINISTRY_INK = '#c00000';  // red — ministry line
    private const BODY_INK     = '#1a1a1a';  // near-black — government, address, contacts

    /**
     * Header HTML — repeated on every page via mPDF's SetHTMLHeader().
     *
     * Mirrors the printed letterhead: national emblem on the left, BITAC gear
     * on the right, and five centred lines between them — centre name, the
     * ministry, the government, the address, then the phone/website line,
     * closed off by a rule across the full width. The address and contacts
     * belong HERE (not the footer) exactly as they do on the real stationery.
     */
    private function headerHtml(?Center $center, string $language = 'bn'): string
    {
        $leftLogo  = $this->logoTag($center?->logoLeftAbsolutePath(),  'GOV');
        $rightLogo = $this->logoTag($center?->logoRightAbsolutePath(), $center?->code ?? 'BITAC');

        $title = self::TITLE_INK;
        $red   = self::MINISTRY_INK;
        $ink   = self::BODY_INK;
        // The rule that closes the letterhead block. Per-centre so a centre
        // can match its own stationery.
        $rule  = $center?->letterhead_color ?: '#1e40af';

        if ($language === 'en') {
            // English-only letterhead — same shape, English wording.
            $nameEn    = $this->escape($center?->name ?? 'Bangladesh Industrial Technical Assistance Centre (BITAC)');
            $addressEn = $this->escape($center?->address ?? '');
            $contactEn = $this->contactLine($center, 'en');

            $addressRow = $addressEn
                ? '<div style="font-size: 9.5pt; color: ' . $ink . '; margin-top: 2pt;">' . $addressEn . '</div>' : '';
            $contactRow = $contactEn
                ? '<div style="font-size: 8.5pt; color: ' . $ink . '; margin-top: 1pt;">' . $contactEn . '</div>' : '';

            return <<<HTML
<table width="100%" cellspacing="0" cellpadding="0" style="border-bottom: 1pt solid {$rule}; padding-bottom: 3pt;">
    <tr>
        <td width="70" align="center" style="vertical-align: middle;">{$leftLogo}</td>
        <td align="center" style="vertical-align: middle; padding: 0 6pt;">
            <div style="font-size: 17pt; font-weight: bold; color: {$title};">{$nameEn}</div>
            <div style="font-size: 11pt; color: {$red}; margin-top: 1pt;">Ministry of Industries</div>
            <div style="font-size: 10pt; color: {$ink}; margin-top: 1pt;">Government of the People's Republic of Bangladesh</div>
            {$addressRow}
            {$contactRow}
        </td>
        <td width="70" align="center" style="vertical-align: middle;">{$rightLogo}</td>
    </tr>
</table>
HTML;
        }

        // Default — the Bangla letterhead.
        $nameBn       = $this->escape($center?->name_bn       ?? 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)');
        $ministryBn   = $this->escape($center?->ministry_bn   ?? 'শিল্প মন্ত্রণালয়');
        $governmentBn = $this->escape($center?->government_bn ?? 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার');
        $addressBn    = $this->escape($center?->address_bn    ?? '');
        $contactBn    = $this->contactLine($center, 'bn');

        $addressRow = $addressBn
            ? '<div style="font-family: siyamrupali; font-size: 9.5pt; color: ' . $ink . '; margin-top: 2pt;">' . $addressBn . '</div>' : '';
        $contactRow = $contactBn
            ? '<div style="font-family: siyamrupali; font-size: 8.5pt; color: ' . $ink . '; margin-top: 1pt;">' . $contactBn . '</div>' : '';

        return <<<HTML
<table width="100%" cellspacing="0" cellpadding="0" style="border-bottom: 1pt solid {$rule}; padding-bottom: 3pt;">
    <tr>
        <td width="70" align="center" style="vertical-align: middle;">{$leftLogo}</td>
        <td align="center" style="vertical-align: middle; padding: 0 6pt;">
            <div style="font-family: siyamrupali; font-size: 19pt; color: {$title};">{$nameBn}</div>
            <div style="font-family: siyamrupali; font-size: 11pt; color: {$red}; margin-top: 1pt;">{$ministryBn}</div>
            <div style="font-family: siyamrupali; font-size: 10pt; color: {$ink}; margin-top: 1pt;">{$governmentBn}</div>
            {$addressRow}
            {$contactRow}
        </td>
        <td width="70" align="center" style="vertical-align: middle;">{$rightLogo}</td>
    </tr>
</table>
HTML;
    }

    /**
     * The single phone/website line that sits under the address, e.g.
     * "ফোন: ০২-৫৫০৩০০৫৭, ০২-৫৫০৩০০৪৬, ওয়েবসাইট : www.bitac.gov.bd".
     * The website is Latin script, so it needs the Latin font inside the
     * Bangla line or mPDF substitutes glyphs oddly.
     */
    private function contactLine(?Center $center, string $language): string
    {
        $website = $this->escape($center?->website ?? '');
        $parts   = [];

        if ($language === 'en') {
            $phone = $this->escape($center?->phone ?? '');
            $email = $this->escape($center?->email ?? '');
            if ($phone) $parts[] = "Phone: {$phone}";
            if ($email) $parts[] = "Email: {$email}";
            if ($website) $parts[] = "Website: {$website}";
            return implode(', ', $parts);
        }

        $phoneBn = $this->escape($center?->phone_bn ?? '');
        $faxBn   = $this->escape($center?->fax_bn   ?? '');
        if ($phoneBn) $parts[] = "ফোন: {$phoneBn}";
        if ($faxBn)   $parts[] = "ফ্যাক্স: {$faxBn}";
        if ($website) {
            $parts[] = 'ওয়েবসাইট : <span style="font-family: dejavusans;">' . $website . '</span>';
        }

        return implode(', ', $parts);
    }

    /**
     * Footer HTML — repeated on every page.
     *
     * Just the page number. The address and contacts moved up into the
     * letterhead where the printed stationery carries them; repeating them
     * here would print them twice.
     */
    private function footerHtml(?Center $center, string $language = 'bn'): string
    {
        return '<div style="text-align: center; font-size: 8pt; color: #9ca3af;">Page {PAGENO} of {nbpg}</div>';
    }

    /**
     * Logo <img> if the file exists; otherwise a dashed-circle placeholder.
     */
    private function logoTag(?string $absolutePath, string $placeholderLabel): string
    {
        if ($absolutePath && is_file($absolutePath)) {
            return '<img src="' . $absolutePath . '" width="62" height="62" />';
        }
        $label = $this->escape($placeholderLabel);
        return '<div style="width: 62pt; height: 62pt; border: 1pt dashed #c7d2fe; border-radius: 50%; color: #6366f1; font-size: 7pt; text-align: center; line-height: 62pt;">' . $label . '</div>';
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Common stylesheet for the inner document body. Pages can override.
     */
    private function stylesheetCss(): string
    {
        return <<<CSS
body { font-family: dejavusans; font-size: 10pt; color: #1f2937; }
.bn { font-family: siyamrupali; }
h1, h2, h3 { color: #1e40af; }
table { border-collapse: collapse; }
CSS;
    }
}
