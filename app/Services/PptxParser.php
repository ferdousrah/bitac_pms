<?php

namespace App\Services;

use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\Shape\Table;
use PhpOffice\PhpPresentation\Shape\RichText;
use Illuminate\Support\Facades\Log;

/**
 * PptxParser — extracts slide content from a .pptx file.
 *
 * Returns structured slide data compatible with the shared screen renderer.
 * Each slide gets: title, bullets, body, optional table.
 */
class PptxParser
{
    /**
     * Parse a PPTX file path and return an array of slide objects.
     *
     * @param string $path  Absolute path to the .pptx file
     * @return array{slides: array, error?: string}
     */
    public function parse(string $path): array
    {
        if (!file_exists($path)) {
            return ['slides' => [], 'error' => 'File not found'];
        }

        try {
            $reader = IOFactory::createReader('PowerPoint2007');
            $presentation = $reader->load($path);

            $slides = [];
            foreach ($presentation->getAllSlides() as $idx => $slide) {
                $slides[] = $this->extractSlide($slide, $idx + 1);
            }

            return ['slides' => $slides];
        } catch (\Throwable $e) {
            Log::warning('PPTX parse failed: ' . $e->getMessage(), ['path' => $path]);
            return ['slides' => [], 'error' => 'Could not parse PowerPoint: ' . $e->getMessage()];
        }
    }

    /**
     * Extract content from a single slide.
     */
    private function extractSlide($slide, int $slideNum): array
    {
        $title = null;
        $bullets = [];
        $bodyChunks = [];
        $tables = [];

        foreach ($slide->getShapeCollection() as $shape) {
            // Table extraction
            if ($shape instanceof Table) {
                $tables[] = $this->extractTable($shape);
                continue;
            }

            // Rich text extraction
            if ($shape instanceof RichText) {
                $texts = $this->extractRichText($shape);
                if (empty($texts)) continue;

                // First substantial text on slide → likely the title (if not set yet)
                if (!$title && count($texts) === 1 && mb_strlen($texts[0]) < 150) {
                    $title = $texts[0];
                    continue;
                }

                // Multiple text lines → bullets
                if (count($texts) > 1) {
                    foreach ($texts as $t) {
                        $trimmed = trim($t);
                        if ($trimmed !== '') $bullets[] = $trimmed;
                    }
                } else {
                    $bodyChunks[] = $texts[0];
                }
            }
        }

        // If no title was detected, use a default
        if (!$title) $title = "Slide {$slideNum}";

        $body = !empty($bodyChunks) ? implode("\n\n", $bodyChunks) : null;
        // If body is the same as title, drop it
        if ($body === $title) $body = null;

        $slideData = [
            'title'         => $title,
            'layout'        => 'content',
            'speaker_notes' => $this->buildSpeakerNotes($title, $bullets, $body, $slideNum),
        ];

        if (!empty($bullets)) $slideData['bullets'] = $bullets;
        if ($body) $slideData['body'] = $body;
        if (!empty($tables)) $slideData['table'] = $tables[0]; // use first table found

        return $slideData;
    }

    /**
     * Extract all text paragraphs from a RichText shape.
     */
    private function extractRichText(RichText $shape): array
    {
        $out = [];
        foreach ($shape->getParagraphs() as $paragraph) {
            $lineText = '';
            foreach ($paragraph->getRichTextElements() as $element) {
                $text = method_exists($element, 'getText') ? $element->getText() : '';
                if ($text) $lineText .= $text;
            }
            $lineText = trim($lineText);
            if ($lineText !== '') $out[] = $lineText;
        }
        return $out;
    }

    /**
     * Extract table data into our standard format.
     */
    private function extractTable(Table $table): array
    {
        $rows = [];
        $headers = [];

        foreach ($table->getRows() as $rowIdx => $row) {
            $rowData = [];
            foreach ($row->getCells() as $cellIdx => $cell) {
                $cellText = '';
                foreach ($cell->getParagraphs() as $paragraph) {
                    foreach ($paragraph->getRichTextElements() as $element) {
                        if (method_exists($element, 'getText')) {
                            $cellText .= $element->getText();
                        }
                    }
                    $cellText .= ' ';
                }
                $cellText = trim($cellText);

                if ($rowIdx === 0) {
                    $headers[] = $cellText ?: "Col" . ($cellIdx + 1);
                } else {
                    $header = $headers[$cellIdx] ?? "Col" . ($cellIdx + 1);
                    $rowData[$header] = $cellText;
                }
            }
            if ($rowIdx > 0 && !empty($rowData)) {
                $rows[] = $rowData;
            }
        }

        return ['headers' => $headers, 'rows' => $rows];
    }

    /**
     * Generate simple speaker notes from slide content.
     */
    private function buildSpeakerNotes(string $title, array $bullets, ?string $body, int $slideNum): string
    {
        $parts = ["Slide {$slideNum}: {$title}."];
        if ($body) $parts[] = $body;
        if (!empty($bullets)) $parts[] = "Key points: " . implode(', ', $bullets) . '.';
        return implode(' ', $parts);
    }

    /**
     * Convert parsed slides to a plain-text summary for AI analysis.
     */
    public function toTextSummary(array $slides): string
    {
        $out = [];
        foreach ($slides as $i => $s) {
            $num = $i + 1;
            $out[] = "--- Slide {$num} ---";
            $out[] = "Title: " . ($s['title'] ?? '(no title)');
            if (!empty($s['bullets'])) {
                $out[] = "Bullets:\n- " . implode("\n- ", $s['bullets']);
            }
            if (!empty($s['body'])) {
                $out[] = "Body: " . $s['body'];
            }
            if (!empty($s['table'])) {
                $out[] = "Table (" . count($s['table']['rows']) . " rows): headers = " . implode(', ', $s['table']['headers']);
            }
            $out[] = '';
        }
        return implode("\n", $out);
    }
}
