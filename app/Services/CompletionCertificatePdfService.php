<?php

namespace App\Services;

use App\Models\CompletionCertificate;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Generates a PDF for self-issued completion certificates.
 *
 * The PDF is BITAC-branded (not the customer's letterhead) but clearly
 * states it was issued by the customer's representative and carries
 * their digital signature. Used when the customer chooses to fill the
 * in-portal form instead of uploading a scanned cert.
 */
class CompletionCertificatePdfService
{
    public function generatePdf(CompletionCertificate $cert): string
    {
        $cert->load(['workOrder.product', 'workOrder.customer', 'customer']);
        $wo = $cert->workOrder;
        $customer = $cert->customer;

        $esc = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $fmt = fn($d) => $d ? \Carbon\Carbon::parse($d)->format('d M Y') : '—';
        $sigAbs = $cert->signature_path
            ? \Illuminate\Support\Facades\Storage::disk('public')->path($cert->signature_path)
            : null;

        $stars = '';
        if ($cert->rating) {
            $stars = str_repeat('★', $cert->rating) . str_repeat('☆', 5 - $cert->rating);
        }

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 11pt; line-height: 1.55; padding: 30pt 36pt; }
            h1 { font-size: 22pt; text-align: center; color: #0f172a; letter-spacing: 4pt; margin: 0 0 4pt; }
            .subtitle { text-align: center; color: #64748b; font-size: 10pt; letter-spacing: 2pt; text-transform: uppercase; margin-bottom: 24pt; }
            .border-box { border: 1.5pt solid #0f172a; padding: 20pt 24pt; margin-top: 10pt; }
            .ref { text-align: right; font-family: monospace; font-size: 9pt; color: #64748b; margin-bottom: 18pt; }
            .body p { margin: 0 0 10pt; }
            .body strong { color: #0f172a; }
            .footer-row { margin-top: 36pt; display: table; width: 100%; }
            .footer-col { display: table-cell; vertical-align: bottom; }
            .sig-box { border-bottom: 0.75pt solid #0f172a; padding-bottom: 4pt; min-height: 50pt; text-align: center; }
            .sig-img { max-height: 50pt; max-width: 220pt; }
            .label { font-size: 8.5pt; color: #64748b; margin-top: 3pt; text-transform: uppercase; letter-spacing: 1pt; }
            .stars { color: #f59e0b; font-size: 14pt; margin-top: 4pt; }
            .remarks { background: #f8fafc; border-left: 3pt solid #0f172a; padding: 10pt 14pt; margin-top: 14pt; font-style: italic; }
        </style></head><body>';

        $html .= '<h1>COMPLETION CERTIFICATE</h1>';
        $html .= '<div class="subtitle">Acceptance &amp; Performance Acknowledgement</div>';
        $html .= '<div class="ref"><strong>Ref:</strong> ' . $esc($cert->certificate_number)
              . ' &nbsp;|&nbsp; <strong>Issued:</strong> ' . $fmt($cert->issued_date) . '</div>';

        $html .= '<div class="border-box body">';
        $html .= '<p>This is to certify that <strong>' . $esc(optional($wo->customer)->name ?? $customer->name) . '</strong>'
              .  ' has received and accepted the work executed by <strong>Bangladesh Industrial Technical Assistance Centre (BITAC)</strong>'
              .  ' under the following work order:</p>';

        $html .= '<p>'
              . '&nbsp;&nbsp;&nbsp;&nbsp;<strong>Work Order:</strong> ' . $esc($wo->wo_number ?? '—') . '<br>'
              . '&nbsp;&nbsp;&nbsp;&nbsp;<strong>Product / Job:</strong> ' . $esc(optional($wo->product)->name ?? '—') . '<br>'
              . '&nbsp;&nbsp;&nbsp;&nbsp;<strong>Quantity:</strong> ' . $esc((string) ($wo->quantity ?? '—'))
              . '</p>';

        $html .= '<p>The deliverables have been inspected and are found to be in conformance with the agreed specifications and quality requirements.'
              .  ' This certificate is issued in acknowledgement of the satisfactory completion of the said work.</p>';

        if ($cert->rating) {
            $html .= '<p style="margin-top: 14pt;"><strong>Satisfaction Rating:</strong> <span class="stars">' . $stars . '</span> &nbsp;(' . $cert->rating . '/5)</p>';
        }

        if ($cert->remarks) {
            $html .= '<div class="remarks">' . nl2br($esc($cert->remarks)) . '</div>';
        }

        $html .= '<div class="footer-row">';
        $html .= '  <div class="footer-col" style="width: 60%;">'
              . '    <div class="sig-box">'
              . ($sigAbs && is_file($sigAbs) ? '<img class="sig-img" src="' . $sigAbs . '">' : '')
              . '    </div>'
              . '    <div class="label">Signature of the Issuer</div>'
              . '    <p style="margin: 8pt 0 0;"><strong>' . $esc($cert->issued_by_name) . '</strong>'
              . ($cert->issued_by_designation ? '<br><span style="font-size: 9.5pt;">' . $esc($cert->issued_by_designation) . '</span>' : '')
              . '<br><span style="font-size: 9.5pt;">' . $esc(optional($wo->customer)->name ?? $customer->name) . '</span></p>'
              . '  </div>';
        $html .= '  <div class="footer-col" style="width: 40%; text-align: right;">'
              . '    <p style="margin: 0; font-size: 8.5pt; color: #64748b;">Generated electronically via the<br>BITAC Customer Portal on ' . $fmt(now()) . '</p>'
              . '  </div>';
        $html .= '</div>';

        $html .= '</div></body></html>';

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');
        return $pdf->output();
    }
}
