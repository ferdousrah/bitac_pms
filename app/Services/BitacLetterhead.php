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
            'margin_top'       => 36,    // sits just under the letterhead header
            'margin_bottom'    => 26,    // enough for footer
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
     * Header HTML — repeated on every page via mPDF's SetHTMLHeader().
     */
    private function headerHtml(?Center $center, string $language = 'bn'): string
    {
        $color       = $center?->letterhead_color ?: '#1e40af';
        $captionEn   = $this->escape($center?->caption_en   ?? 'BITAC – A Center of Excellence');

        $leftLogo  = $this->logoTag($center?->logoLeftAbsolutePath(),  $center?->code ?? 'BITAC');
        $rightLogo = $this->logoTag($center?->logoRightAbsolutePath(), 'GOV');

        if ($language === 'en') {
            // English-only letterhead — for foreign clients, MoU partners, etc.
            $nameEn     = $this->escape($center?->name ?? 'Bangladesh Industrial Technical Assistance Centre (BITAC)');
            $ministryEn = 'Ministry of Industries';
            $governmentEn = "Government of the People's Republic of Bangladesh";

            return <<<HTML
<table width="100%" cellspacing="0" cellpadding="0" style="border-bottom: 1.5pt solid {$color}; padding-bottom: 4pt;">
    <tr>
        <td width="90" align="center" style="vertical-align: middle;">{$leftLogo}</td>
        <td align="center" style="vertical-align: middle; padding: 0 8pt;">
            <div style="font-size: 9pt; color: {$color}; font-style: italic;">{$captionEn}</div>
            <div style="font-size: 15pt; color: #064e3b; font-weight: bold; margin-top: 2pt;">{$nameEn}</div>
            <div style="font-size: 11pt; color: #1f2937; margin-top: 1pt;">{$ministryEn}</div>
            <div style="font-size: 10pt; color: #4b5563; margin-top: 1pt;">{$governmentEn}</div>
        </td>
        <td width="90" align="center" style="vertical-align: middle;">{$rightLogo}</td>
    </tr>
</table>
HTML;
        }

        // Default — Bangla/bilingual letterhead.
        $nameBn      = $this->escape($center?->name_bn      ?? 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)');
        $ministryBn  = $this->escape($center?->ministry_bn  ?? 'শিল্প মন্ত্রণালয়');
        $governmentBn= $this->escape($center?->government_bn?? 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার');

        return <<<HTML
<table width="100%" cellspacing="0" cellpadding="0" style="border-bottom: 1.5pt solid {$color}; padding-bottom: 4pt;">
    <tr>
        <td width="90" align="center" style="vertical-align: middle;">{$leftLogo}</td>
        <td align="center" style="vertical-align: middle; padding: 0 8pt;">
            <div style="font-size: 9pt; color: {$color}; font-style: italic;">{$captionEn}</div>
            <div style="font-family: siyamrupali; font-size: 15pt; color: #064e3b; margin-top: 2pt;">{$nameBn}</div>
            <div style="font-family: siyamrupali; font-size: 11pt; color: #1f2937; margin-top: 1pt;">{$ministryBn}</div>
            <div style="font-family: siyamrupali; font-size: 10pt; color: #4b5563; margin-top: 1pt;">{$governmentBn}</div>
        </td>
        <td width="90" align="center" style="vertical-align: middle;">{$rightLogo}</td>
    </tr>
</table>
HTML;
    }

    /**
     * Footer HTML — repeated on every page. Page numbers via mPDF's {PAGENO}/{nbpg}.
     */
    private function footerHtml(?Center $center, string $language = 'bn'): string
    {
        $color    = $center?->letterhead_color ?: '#1e40af';
        $website  = $this->escape($center?->website    ?? '');

        if ($language === 'en') {
            // English-only footer — uses the center's English address/phone fields
            // (the same `name`-style columns) with English labels.
            $addressEn = $this->escape($center?->address ?? '');
            $phoneEn   = $this->escape($center?->phone   ?? '');
            $emailEn   = $this->escape($center?->email   ?? '');

            $contactParts = [];
            if ($phoneEn) $contactParts[] = "Phone: {$phoneEn}";
            if ($emailEn) $contactParts[] = "Email: {$emailEn}";
            $contactLine = implode(', ', $contactParts);
            if ($website) {
                $contactLine .= ($contactLine ? ' &nbsp;|&nbsp; ' : '') . "Website: {$website}";
            }

            return <<<HTML
<div style="border-top: 1.5pt solid {$color}; padding-top: 4pt; text-align: center;">
    <div style="font-size: 11pt; color: #1f2937;">{$addressEn}</div>
    <div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">{$contactLine}</div>
    <div style="font-size: 8pt; color: #9ca3af; margin-top: 3pt;">Page {PAGENO} of {nbpg}</div>
</div>
HTML;
        }

        $addressBn= $this->escape($center?->address_bn ?? '');
        $phoneBn  = $this->escape($center?->phone_bn   ?? '');
        $faxBn    = $this->escape($center?->fax_bn     ?? '');

        // Build the contact line conditionally so empty fields don't show as ":  |  :"
        $contactParts = [];
        if ($phoneBn) $contactParts[] = "ফোন: {$phoneBn}";
        if ($faxBn)   $contactParts[] = "ফ্যাক্স: {$faxBn}";
        $contactLine = implode(', ', $contactParts);
        if ($website) {
            $contactLine .= ($contactLine ? ' &nbsp;|&nbsp; ' : '') .
                            'ওয়েবসাইট: <span style="font-family: dejavusans;">' . $website . '</span>';
        }

        return <<<HTML
<div style="border-top: 1.5pt solid {$color}; padding-top: 4pt; text-align: center;">
    <div style="font-family: siyamrupali; font-size: 11pt; color: #1f2937;">{$addressBn}</div>
    <div style="font-family: siyamrupali; font-size: 9pt; color: #4b5563; margin-top: 1pt;">{$contactLine}</div>
    <div style="font-size: 8pt; color: #9ca3af; margin-top: 3pt;">Page {PAGENO} of {nbpg}</div>
</div>
HTML;
    }

    /**
     * Logo <img> if the file exists; otherwise a dashed-circle placeholder.
     */
    private function logoTag(?string $absolutePath, string $placeholderLabel): string
    {
        if ($absolutePath && is_file($absolutePath)) {
            return '<img src="' . $absolutePath . '" width="55" height="55" />';
        }
        $label = $this->escape($placeholderLabel);
        return '<div style="width: 55pt; height: 55pt; border: 1pt dashed #c7d2fe; border-radius: 50%; color: #6366f1; font-size: 7pt; text-align: center; line-height: 55pt;">' . $label . '</div>';
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
