<?php

namespace App\Services;

use App\Models\OperationSheet;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class OperationSheetService
{
    public function generateQrCode(OperationSheet $sheet): string
    {
        // QR identifier is keyed off the Job number, not the WO number — per
        // the rule that WO numbers don't appear anywhere from op-sheet onward.
        $job = $sheet->workOrder->job_number ?? $sheet->workOrder->id;
        return 'JOB-' . $job . '-SHEET-' . $sheet->sheet_number;
    }

    /**
     * Sheet number = item sequence within the WO, padded to 2 digits.
     * Item 1 → "01", Item 2 → "02". The full QR is WO+sheet so collisions
     * across WOs aren't a concern. WO-wide sheets (legacy, item_id NULL)
     * fall back to count-based numbering.
     */
    public function generateSheetNumber(WorkOrder $workOrder, ?int $itemId = null): string
    {
        if ($itemId) {
            $workOrder->loadMissing('items');
            $idx = $workOrder->items->search(fn ($i) => $i->id === $itemId);
            if ($idx !== false) {
                return str_pad((int) $idx + 1, 2, '0', STR_PAD_LEFT);
            }
        }
        $count = $workOrder->operationSheets()->count();
        return str_pad($count + 1, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Render the Operation Sheet on BITAC letterhead matching the paper form:
     *   Row 1: কাজের নামঃ (Job Title) | জব নম্বরঃ (Job No)
     *   Row 2: কাজের বিবরণঃ (Job Desc) | ক্রেতার নামঃ (Customer)
     *   Row 3: ম্যাটেরিয়ালঃ (Material) | অংশ নংঃ (Part No) | পরিমানঃ (Quantity)
     * Then a routing table with ক্রঃ নং | কার্য বিন্যাস | সেকশন | মন্তব্য.
     * Footer: প্রস্তুতকারী | যাচাইকারী | অনুমোদনকারী.
     *
     * Returns raw PDF bytes (via BitacLetterhead) rather than a DomPDF instance.
     */
    public function generatePdf(OperationSheet $sheet): string
    {
        $sheet->load([
            'workOrder.customer', 'workOrder.items',
            'workOrder.sections.section',
            'workOrderItem.rfqItem.samplePhotos',
            'workOrderItem.rfqItem.drawings', 'steps.section', 'steps.machine',
            'createdBy',
        ]);
        $wo   = $sheet->workOrder;
        $item = $sheet->workOrderItem;

        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $jobTitle = $esc($sheet->job_title ?: ($item?->description ?? $wo->product?->name ?? '—'));
        $jobNo    = $esc($wo->job_number ?? '—');
        $jobDesc  = $esc($sheet->job_description ?? '');
        $customer = $esc($wo->customer?->name ?? '—');
        $material = $esc($sheet->material ?? '');

        // Part No is item-sequence/total when this is an item-wise sheet.
        $partNo = '—';
        if ($item && $wo->items->isNotEmpty()) {
            $idx = $wo->items->search(fn ($i) => $i->id === $item->id);
            if ($idx !== false) {
                $partNo = ($idx + 1) . '/' . $wo->items->count();
            }
        }
        $partNo = $esc($partNo);

        $qty = $esc(($item ? rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') . ' ' . ($item->unit ?? '') : $wo->quantity));

        // Centered title — English only.
        $titleBlock = '<div style="text-align: center; margin-bottom: 10pt;">'
            . '<div style="font-size: 14pt; font-weight: bold; color: #000; letter-spacing: 1pt;">OPERATION SHEET</div>'
            . '</div>';

        // Top header table (3 rows, mirrors BITAC paper layout — English labels)
        $headerHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">';
        // Row 1: Job Title | Job No
        $headerHtml .= '<tr>'
            . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; width: 65%;">'
            .   '<b>Job Title:</b> ' . $jobTitle
            . '</td>'
            . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;">'
            .   '<b>Job No:</b> <b style="font-family: dejavusansmono;">' . $jobNo . '</b>'
            . '</td>'
            . '</tr>';
        // Row 2: Job Description | Customer
        $headerHtml .= '<tr>'
            . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;">'
            .   '<b>Job Description:</b> ' . $jobDesc
            . '</td>'
            . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;">'
            .   '<b>Customer:</b> ' . $customer
            . '</td>'
            . '</tr>';
        // Row 3: Material | Part No + Quantity
        $headerHtml .= '<tr>'
            . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;">'
            .   '<b>Material:</b> ' . $material
            . '</td>'
            . '<td style="border: 0.75pt solid #000; padding: 0; font-size: 10pt;">'
            .   '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">'
            .     '<tr>'
            .       '<td style="padding: 5pt 8pt; border-right: 0.75pt solid #000; font-size: 10pt;">'
            .         '<b>Part No:</b> <span style="font-family: dejavusansmono;">' . $partNo . '</span>'
            .       '</td>'
            .       '<td style="padding: 5pt 8pt; font-size: 10pt;">'
            .         '<b>Quantity:</b> ' . $qty
            .       '</td>'
            .     '</tr>'
            .   '</table>'
            . '</td>'
            . '</tr>';
        $headerHtml .= '</table>';

        // Sample photo / drawing block — sourced from the RFQ item attachments
        // (uploaded during RFQ creation). Prefers sample photos over drawings;
        // only embeds files mPDF can render (jpg/png). Multi-page PDF drawings
        // are skipped — they'd need rasterisation which is out of scope here.
        $imageBlock = '';
        $candidates = collect();
        $rfqItem = $item?->rfqItem;
        if ($rfqItem) {
            $candidates = $candidates->merge($rfqItem->samplePhotos)->merge($rfqItem->drawings);
        }
        $imageTag = '';
        foreach ($candidates as $file) {
            $ext = strtolower(pathinfo($file->stored_path ?? '', PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
                continue;
            }
            $abs = storage_path('app/public/' . ltrim($file->stored_path, '/'));
            if (!is_file($abs)) continue;
            $imageTag = '<img src="file://' . str_replace('\\', '/', $abs) . '" '
                . 'style="max-height: 180pt; max-width: 280pt;" />';
            break;
        }
        if ($imageTag !== '') {
            $imageBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
                . $imageTag
                . '</div>';
        }

        // Operation routing table — English headers + section names.
        $routingHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">';
        $routingHtml .= '<thead><tr style="background:#f3f4f6;">'
            . '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 10pt; width: 12%;">Sl. No</th>'
            . '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 10pt;">Operation</th>'
            . '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 10pt; width: 25%;">Section</th>'
            . '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 10pt; width: 28%;">Remarks</th>'
            . '</tr></thead><tbody>';
        $steps = $sheet->steps->sortBy('sequence');
        $rowCount = 0;
        if ($steps->isEmpty()) {
            $routingHtml .= '<tr><td colspan="4" style="border: 0.75pt solid #000; padding: 12pt; font-size: 9pt; color: #666; text-align: center; font-style: italic;">No operations defined.</td></tr>';
        } else {
            foreach ($steps->values() as $s) {
                $rowCount++;
                $opName  = $s->operation_name ?? ($s->section?->name ?? '—');
                $secName = $s->section?->name ?? '—';
                $remarks = $s->tooling_notes ?? '';
                $routingHtml .= '<tr>'
                    . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt; text-align: center; font-family: dejavusansmono;">' . str_pad((string) $rowCount, 2, '0', STR_PAD_LEFT) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt;">' . $esc($opName) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt;">' . $esc($secName) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 9.5pt;">' . nl2br($esc($remarks)) . '</td>'
                    . '</tr>';
            }
        }

        // QC (and any other non-production routing stop) is not editable in the
        // Op Sheet builder, but the printed sheet should still reflect the full
        // physical journey. Append a row per WO section whose section isn't
        // production_shop — sequence preserved from the WO's routing order.
        $stepSectionIds = $sheet->steps->pluck('section_id')->filter()->all();
        $extraStops = $wo->sections
            ->filter(fn ($s) => $s->section && $s->section->type !== 'production_shop')
            ->sortBy('sequence')
            ->values();
        foreach ($extraStops as $stop) {
            $rowCount++;
            // Use the English name (e.g. "Quality Control") in BOTH the
            // Operation and Section columns. Remarks stays blank for these
            // non-production stops — nothing for PCD to plan there.
            $secName = $esc($stop->section?->name ?? '—');
            $routingHtml .= '<tr>'
                . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt; text-align: center; font-family: dejavusansmono;">' . str_pad((string) $rowCount, 2, '0', STR_PAD_LEFT) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt;">' . $secName . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt;">' . $secName . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 4pt 6pt;">&nbsp;</td>'
                . '</tr>';
        }
        $routingHtml .= '</tbody></table>';

        // প্রস্তুতকারী auto-fills with the PCD officer's signature image (if uploaded),
        // name, and designation. Verified By / Approved By stay blank for hand-signing.
        $preparer = $sheet->createdBy;
        $sigImg   = '';
        if ($preparer && $preparer->signature_path) {
            $sigPath = storage_path('app/public/' . ltrim($preparer->signature_path, '/'));
            if (is_file($sigPath)) {
                $sigImg = '<img src="file://' . str_replace('\\', '/', $sigPath) . '" '
                    . 'style="max-height: 36pt; max-width: 80%;" />';
            }
        }
        $preparerName = $preparer ? $esc($preparer->name) : '';
        $preparerDesg = $preparer ? $esc($preparer->designation ?? '') : '';

        $preparedCell = '<div style="min-height: 38pt; padding-bottom: 2pt;">' . $sigImg . '</div>'
            . '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; color: #000;"><b>Prepared By</b></div>'
            . ($preparerName !== '' ? '<div style="font-size: 9.5pt; color: #000; margin-top: 1pt;">' . $preparerName . '</div>' : '')
            . ($preparerDesg !== '' ? '<div style="font-size: 8.5pt; color: #555; margin-top: 1pt;">' . $preparerDesg . '</div>' : '');

        $blankCell = fn (string $label) => '<div style="min-height: 38pt;">&nbsp;</div>'
            . '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; color: #000;"><b>' . $label . '</b></div>';

        // Footer signatures — English labels
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28pt;">'
            . '<tr>'
            .   '<td width="33%" style="vertical-align: bottom; padding-right: 12pt; text-align: center;">' . $preparedCell . '</td>'
            .   '<td width="33%" style="vertical-align: bottom; padding: 0 6pt; text-align: center;">' . $blankCell('Verified By') . '</td>'
            .   '<td width="33%" style="vertical-align: bottom; padding-left: 12pt; text-align: center;">' . $blankCell('Approved By') . '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = $titleBlock . $headerHtml . $imageBlock . $routingHtml . $signatureBlock;
        $docTitle = 'Operation Sheet ' . $sheet->sheet_number;

        return app(\App\Services\BitacLetterhead::class)->render($bodyHtml, $docTitle, null, 'en');
    }

    public function generateQrImage(string $qrCode): string
    {
        // SVG backend — no imagick required, works on Windows/XAMPP
        return base64_encode(QrCode::format('svg')->size(150)->margin(1)->generate($qrCode));
    }
}
