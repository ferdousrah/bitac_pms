<?php

namespace App\Support;

use Mpdf\Mpdf;
use setasign\Fpdi\PdfParser\StreamReader;

/**
 * Several finished PDFs into one, page for page — each page keeps its own
 * size and orientation (a landscape মূসক ৬.৩ stays landscape beside an A4
 * bill). The pages are imported as they are, so nothing is re-laid out.
 */
class PdfMerge
{
    /** @param string[] $documents raw PDF bytes, in the order they should appear */
    public static function merge(array $documents): string
    {
        $tempDir = storage_path('framework/mpdf');
        if (! is_dir($tempDir)) {
            @mkdir($tempDir, 0775, true);
        }

        $out = new Mpdf([
            'mode' => 'utf-8', 'tempDir' => $tempDir,
            'margin_left' => 0, 'margin_right' => 0, 'margin_top' => 0, 'margin_bottom' => 0,
            'margin_header' => 0, 'margin_footer' => 0,
        ]);

        foreach ($documents as $bytes) {
            if (! is_string($bytes) || ! str_starts_with($bytes, '%PDF')) {
                continue;
            }
            $pages = $out->setSourceFile(StreamReader::createByString($bytes));
            for ($p = 1; $p <= $pages; $p++) {
                $tpl  = $out->importPage($p);
                $size = $out->getTemplateSize($tpl);
                $out->AddPageByArray([
                    'orientation' => $size['orientation'],
                    'sheet-size'  => [$size['width'], $size['height']],
                ]);
                $out->useTemplate($tpl);
            }
        }

        return $out->Output('', 'S');
    }
}
