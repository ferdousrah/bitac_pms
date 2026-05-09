<?php

namespace App\Services\AiAgent;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\Shape\Chart\Series;
use PhpOffice\PhpPresentation\Shape\Chart\Type\Bar3D;
use PhpOffice\PhpPresentation\Shape\Chart\Type\Pie3D;
use PhpOffice\PhpPresentation\Shape\Chart\Type\Line;
use PhpOffice\PhpPresentation\Style\Alignment;
use PhpOffice\PhpPresentation\Style\Color;
use PhpOffice\PhpPresentation\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * AI-driven report generator. Creates downloadable files from structured data.
 * All files are stored in storage/app/public/ai-reports/ and a download URL is returned.
 */
class ReportGenerator
{
    private string $disk = 'public';
    private string $dir  = 'ai-reports';

    /**
     * Generate an Excel (.xlsx) report from tabular data.
     *
     * @param  string  $title    Report title / filename
     * @param  array   $headers  Column headers
     * @param  array   $rows     Array of associative rows
     * @param  array   $summary  Optional summary key-value pairs shown at the top
     * @return array{url: string, filename: string, type: string}
     */
    public function excel(string $title, array $headers, array $rows, array $summary = []): array
    {
        $filename = $this->filename($title, 'xlsx');
        $path     = "{$this->dir}/{$filename}";

        $export = new class($title, $headers, $rows, $summary) implements FromArray, WithHeadings, WithTitle, WithStyles {
            public function __construct(
                private string $title,
                private array  $headers,
                private array  $rows,
                private array  $summary
            ) {}

            public function headings(): array { return $this->headers; }

            public function array(): array
            {
                return array_map(fn($row) => array_values(
                    array_intersect_key($row, array_flip(
                        array_map(fn($h) => Str::snake(strtolower($h)), $this->headers)
                    )) ?: $row
                ), $this->rows);
            }

            public function title(): string { return Str::limit($this->title, 31); }

            public function styles(Worksheet $sheet): array
            {
                return [
                    1 => ['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']],
                          'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E40AF']]],
                ];
            }
        };

        Excel::store($export, $path, $this->disk);

        return $this->result($filename, 'xlsx');
    }

    /**
     * Generate a PDF report from HTML content or structured data.
     */
    public function pdf(string $title, string $htmlBody, array $meta = []): array
    {
        $filename = $this->filename($title, 'pdf');

        $html = $this->pdfTemplate($title, $htmlBody, $meta);
        $pdf  = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        Storage::disk($this->disk)->put("{$this->dir}/{$filename}", $pdf->output());

        return $this->result($filename, 'pdf');
    }

    /**
     * Generate a PDF from tabular data (auto-builds the HTML).
     */
    public function pdfTable(string $title, array $headers, array $rows, array $summary = []): array
    {
        $summaryHtml = '';
        if ($summary) {
            $summaryHtml = '<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">';
            foreach ($summary as $k => $v) {
                $summaryHtml .= "<div style='display:inline-block;margin-right:24px;'><strong style='color:#64748b;font-size:10px;text-transform:uppercase;'>{$k}</strong><br><span style='font-size:16px;font-weight:bold;color:#0f172a;'>{$v}</span></div>";
            }
            $summaryHtml .= '</div>';
        }

        $tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr>';
        foreach ($headers as $h) {
            $tableHtml .= "<th style='padding:8px 10px;background:#1e40af;color:white;text-align:left;font-size:10px;text-transform:uppercase;'>{$h}</th>";
        }
        $tableHtml .= '</tr></thead><tbody>';
        foreach ($rows as $i => $row) {
            $bg = $i % 2 === 0 ? '#ffffff' : '#f8fafc';
            $tableHtml .= "<tr style='background:{$bg};'>";
            foreach (array_values($row) as $val) {
                $tableHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;'>{$val}</td>";
            }
            $tableHtml .= '</tr>';
        }
        $tableHtml .= '</tbody></table>';

        return $this->pdf($title, $summaryHtml . $tableHtml, ['rows' => count($rows)]);
    }

    /**
     * Generate a PowerPoint (.pptx) presentation.
     *
     * @param  string  $title       Presentation title
     * @param  array   $slides      Array of slide data: [['title' => '...', 'body' => '...', 'bullets' => [...]], ...]
     * @param  array   $summary     Optional KPI summary for the first slide
     * @return array{url: string, filename: string, type: string}
     */
    public function powerpoint(string $title, array $slides, array $summary = []): array
    {
        $filename = $this->filename($title, 'pptx');
        $pptx     = new PhpPresentation();

        // ── Title slide ──
        $titleSlide = $pptx->getActiveSlide();
        $shape = $titleSlide->createRichTextShape()
            ->setHeight(200)->setWidth(900)
            ->setOffsetX(40)->setOffsetY(180);
        $shape->getActiveParagraph()->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $textRun = $shape->createTextRun($title);
        $textRun->getFont()->setBold(true)->setSize(28)->setColor(new Color('FF1E40AF'));

        // Subtitle
        $subShape = $titleSlide->createRichTextShape()
            ->setHeight(60)->setWidth(900)
            ->setOffsetX(40)->setOffsetY(380);
        $sub = $subShape->createTextRun('BITAC PMS · Generated ' . now()->format('d M Y, H:i'));
        $sub->getFont()->setSize(12)->setColor(new Color('FF64748B'));

        // Summary KPIs on title slide
        if ($summary) {
            $kpiShape = $titleSlide->createRichTextShape()
                ->setHeight(80)->setWidth(900)
                ->setOffsetX(40)->setOffsetY(440);
            $kpiText = collect($summary)->map(fn($v, $k) => "{$k}: {$v}")->implode('  ·  ');
            $kpiRun = $kpiShape->createTextRun($kpiText);
            $kpiRun->getFont()->setSize(11)->setBold(true)->setColor(new Color('FF0F172A'));
        }

        // ── Content slides ──
        foreach ($slides as $slideData) {
            $slide = $pptx->createSlide();

            // Title
            $tShape = $slide->createRichTextShape()
                ->setHeight(60)->setWidth(900)
                ->setOffsetX(40)->setOffsetY(20);
            $tRun = $tShape->createTextRun($slideData['title'] ?? 'Slide');
            $tRun->getFont()->setBold(true)->setSize(22)->setColor(new Color('FF1E40AF'));

            // Body text
            if (!empty($slideData['body'])) {
                $bShape = $slide->createRichTextShape()
                    ->setHeight(200)->setWidth(900)
                    ->setOffsetX(40)->setOffsetY(100);
                $bRun = $bShape->createTextRun($slideData['body']);
                $bRun->getFont()->setSize(13)->setColor(new Color('FF334155'));
            }

            // Bullets
            if (!empty($slideData['bullets'])) {
                $blShape = $slide->createRichTextShape()
                    ->setHeight(350)->setWidth(880)
                    ->setOffsetX(50)->setOffsetY(160);
                foreach ($slideData['bullets'] as $bullet) {
                    $para = $blShape->createParagraph();
                    $para->getAlignment()->setMarginLeft(20)->setIndent(-15);
                    $run = $para->createTextRun("• {$bullet}");
                    $run->getFont()->setSize(12)->setColor(new Color('FF334155'));
                }
            }

            // Table data
            if (!empty($slideData['table'])) {
                $tableData = $slideData['table'];
                $cols = count($tableData['headers'] ?? []);
                $rows = count($tableData['rows'] ?? []);
                if ($cols > 0 && $rows > 0) {
                    $tbl = $slide->createTableShape($cols)
                        ->setHeight($rows * 30 + 35)->setWidth(880)
                        ->setOffsetX(40)->setOffsetY(180);

                    // Header row
                    $headerRow = $tbl->createRow();
                    $headerRow->setHeight(35);
                    foreach ($tableData['headers'] as $i => $h) {
                        $cell = $headerRow->getCell($i);
                        $cell->createTextRun($h)->getFont()->setBold(true)->setSize(10)->setColor(new Color('FFFFFFFF'));
                        $cell->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FF1E40AF'));
                    }

                    // Data rows
                    foreach ($tableData['rows'] as $rowData) {
                        $row = $tbl->createRow();
                        $row->setHeight(28);
                        foreach (array_values($rowData) as $j => $val) {
                            if ($j < $cols) {
                                $cell = $row->getCell($j);
                                $cell->createTextRun((string) $val)->getFont()->setSize(10)->setColor(new Color('FF334155'));
                            }
                        }
                    }
                }
            }

            // Native PPTX chart (bar3d, pie3d, line)
            if (!empty($slideData['chart'])) {
                $chartData = $slideData['chart'];
                $chartType = $chartData['type'] ?? 'bar';
                $chartItems = $chartData['data'] ?? [];
                $chartColors = ['FF3B82F6','FF10B981','FFF59E0B','FFEF4444','FF8B5CF6','FFF97316','FF06B6D4','FFEC4899','FF64748B'];

                if (!empty($chartItems)) {
                    $labels = array_column($chartItems, 'label');
                    $values = array_column($chartItems, 'value');

                    $chartShape = $slide->createChartShape()
                        ->setHeight(340)->setWidth(860)
                        ->setOffsetX(50)->setOffsetY(120);
                    $chartShape->getTitle()->setText($chartData['title'] ?? '');
                    $chartShape->getTitle()->getFont()->setSize(11)->setBold(true)->setColor(new Color('FF0F172A'));
                    $chartShape->getLegend()->setVisible(true);

                    $series = new Series($chartData['series_name'] ?? 'Data', $values);
                    $series->setShowSeriesName(false);
                    $series->setShowValue(true);
                    $series->getFont()->setSize(8)->setColor(new Color('FF334155'));

                    // Apply colors to each data point
                    foreach ($chartItems as $idx => $item) {
                        $color = new Color($chartColors[$idx % count($chartColors)]);
                        $series->setFill(new Fill())
                            ->getDataPointFill($idx)
                            ->setFillType(Fill::FILL_SOLID)
                            ->setStartColor($color);
                    }

                    if ($chartType === 'pie') {
                        $pieChart = new Pie3D();
                        $pieChart->addSeries($series);
                        $chartShape->getPlotArea()->setType($pieChart);
                    } elseif ($chartType === 'line') {
                        $lineChart = new Line();
                        $lineChart->addSeries($series);
                        $chartShape->getPlotArea()->setType($lineChart);
                    } else {
                        $barChart = new Bar3D();
                        $barChart->addSeries($series);
                        $chartShape->getPlotArea()->setType($barChart);
                    }

                    // Category labels
                    $chartShape->getPlotArea()->getType()->setSeries([]);
                    $series->setLabelPosition(Series::LABEL_BESTFIT);

                    // Re-create with proper categories
                    $seriesWithLabels = new Series($chartData['series_name'] ?? 'Data',
                        array_combine($labels, $values)
                    );
                    $seriesWithLabels->setShowSeriesName(false);
                    $seriesWithLabels->setShowValue(true);
                    $seriesWithLabels->getFont()->setSize(8)->setColor(new Color('FF334155'));

                    foreach ($chartItems as $idx => $item) {
                        $seriesWithLabels->getDataPointFill($idx)
                            ->setFillType(Fill::FILL_SOLID)
                            ->setStartColor(new Color($chartColors[$idx % count($chartColors)]));
                    }

                    if ($chartType === 'pie') {
                        $chart = new Pie3D();
                        $chart->addSeries($seriesWithLabels);
                    } elseif ($chartType === 'line') {
                        $chart = new Line();
                        $chart->addSeries($seriesWithLabels);
                    } else {
                        $chart = new Bar3D();
                        $chart->addSeries($seriesWithLabels);
                    }

                    $chartShape->getPlotArea()->setType($chart);
                }
            }
        }

        // Save
        $writer = IOFactory::createWriter($pptx, 'PowerPoint2007');
        $tempPath = storage_path("app/public/{$this->dir}/{$filename}");
        Storage::disk($this->disk)->makeDirectory($this->dir);
        $writer->save($tempPath);

        return $this->result($filename, 'pptx');
    }

    /**
     * Generate a simple SVG chart image and return a URL.
     */
    public function chartImage(string $title, string $type, array $data): array
    {
        $filename = $this->filename($title, 'svg');
        $svg = match ($type) {
            'bar'   => $this->svgBarChart($title, $data),
            'line'  => $this->svgLineChart($title, $data),
            'pie'   => $this->svgPieChart($title, $data),
            default => $this->svgBarChart($title, $data),
        };

        Storage::disk($this->disk)->put("{$this->dir}/{$filename}", $svg);

        return $this->result($filename, 'svg');
    }

    // ─── SVG Chart Builders ──────────────────────────────────────────

    private function svgBarChart(string $title, array $data): string
    {
        $w = 600; $h = 320; $pad = 60;
        $max = max(1, max(array_column($data, 'value')));
        $barW = min(40, ($w - $pad * 2) / count($data) - 10);
        $colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899'];

        $bars = '';
        foreach ($data as $i => $d) {
            $x  = $pad + $i * (($w - $pad * 2) / count($data)) + 5;
            $bh = ($d['value'] / $max) * ($h - $pad * 2);
            $y  = $h - $pad - $bh;
            $c  = $colors[$i % count($colors)];
            $bars .= "<rect x='{$x}' y='{$y}' width='{$barW}' height='{$bh}' rx='4' fill='{$c}' opacity='0.9'/>";
            $bars .= "<text x='" . ($x + $barW / 2) . "' y='" . ($h - $pad + 16) . "' text-anchor='middle' font-size='10' fill='#64748b'>" . htmlspecialchars($d['label'] ?? '') . "</text>";
            $bars .= "<text x='" . ($x + $barW / 2) . "' y='" . ($y - 6) . "' text-anchor='middle' font-size='10' font-weight='bold' fill='#0f172a'>{$d['value']}</text>";
        }

        return <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {$w} {$h}" width="{$w}" height="{$h}" style="font-family:Inter,system-ui,sans-serif;background:white;border-radius:12px;">
            <text x="{$pad}" y="30" font-size="14" font-weight="bold" fill="#0f172a">{$title}</text>
            <line x1="{$pad}" y1="{$y}" x2="{$pad}" y2="{$h}" stroke="#e2e8f0" stroke-width="1"/>
            {$bars}
        </svg>
        SVG;
    }

    private function svgLineChart(string $title, array $data): string
    {
        $w = 600; $h = 320; $pad = 60;
        $max = max(1, max(array_column($data, 'value')));
        $n = count($data);
        $points = [];
        foreach ($data as $i => $d) {
            $x = $pad + ($i / max(1, $n - 1)) * ($w - $pad * 2);
            $y = $h - $pad - ($d['value'] / $max) * ($h - $pad * 2);
            $points[] = [$x, $y, $d];
        }

        $path = 'M ' . implode(' L ', array_map(fn($p) => "{$p[0]} {$p[1]}", $points));
        $areaPath = $path . " L {$points[$n-1][0]} " . ($h - $pad) . " L {$points[0][0]} " . ($h - $pad) . " Z";

        $dots = '';
        foreach ($points as [$x, $y, $d]) {
            $dots .= "<circle cx='{$x}' cy='{$y}' r='4' fill='#3b82f6' stroke='white' stroke-width='2'/>";
            $dots .= "<text x='{$x}' y='" . ($h - $pad + 16) . "' text-anchor='middle' font-size='9' fill='#64748b'>" . htmlspecialchars($d['label'] ?? '') . "</text>";
        }

        return <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {$w} {$h}" width="{$w}" height="{$h}" style="font-family:Inter,system-ui,sans-serif;background:white;border-radius:12px;">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>
            <text x="{$pad}" y="30" font-size="14" font-weight="bold" fill="#0f172a">{$title}</text>
            <path d="{$areaPath}" fill="url(#lg)"/>
            <path d="{$path}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
            {$dots}
        </svg>
        SVG;
    }

    private function svgPieChart(string $title, array $data): string
    {
        $w = 400; $h = 400; $cx = 200; $cy = 200; $r = 140;
        $total = max(1, array_sum(array_column($data, 'value')));
        $colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#06b6d4','#ec4899','#64748b'];

        $slices = ''; $legend = ''; $angle = -90;
        foreach ($data as $i => $d) {
            $frac = $d['value'] / $total;
            $sweep = $frac * 360;
            $endAngle = $angle + $sweep;
            $a1 = deg2rad($angle); $a2 = deg2rad($endAngle);
            $x1 = $cx + $r * cos($a1); $y1 = $cy + $r * sin($a1);
            $x2 = $cx + $r * cos($a2); $y2 = $cy + $r * sin($a2);
            $large = $sweep > 180 ? 1 : 0;
            $c = $colors[$i % count($colors)];
            $slices .= "<path d='M {$cx} {$cy} L {$x1} {$y1} A {$r} {$r} 0 {$large} 1 {$x2} {$y2} Z' fill='{$c}' stroke='white' stroke-width='2'/>";
            $ly = 30 + $i * 18;
            $legend .= "<rect x='" . ($w + 10) . "' y='{$ly}' width='12' height='12' rx='2' fill='{$c}'/>";
            $legend .= "<text x='" . ($w + 28) . "' y='" . ($ly + 10) . "' font-size='11' fill='#334155'>" . htmlspecialchars($d['label'] ?? '') . " ({$d['value']})</text>";
            $angle = $endAngle;
        }

        $totalW = $w + 180;
        return <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {$totalW} {$h}" width="{$totalW}" height="{$h}" style="font-family:Inter,system-ui,sans-serif;background:white;border-radius:12px;">
            <text x="20" y="20" font-size="14" font-weight="bold" fill="#0f172a">{$title}</text>
            {$slices}
            {$legend}
        </svg>
        SVG;
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private function filename(string $title, string $ext): string
    {
        Storage::disk($this->disk)->makeDirectory($this->dir);
        return Str::slug($title) . '-' . now()->format('Ymd-His') . '.' . $ext;
    }

    private function result(string $filename, string $type): array
    {
        return [
            'url'      => url("/ai-reports/download/{$filename}"),
            'filename' => $filename,
            'type'     => $type,
        ];
    }

    private function pdfTemplate(string $title, string $body, array $meta): string
    {
        $date = now()->format('d M Y, H:i');
        $metaHtml = collect($meta)->map(fn($v, $k) => "<span style='margin-right:16px;'><strong>{$k}:</strong> {$v}</span>")->implode('');
        return <<<HTML
        <!DOCTYPE html>
        <html><head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #334155; margin: 30px; }
                h1 { font-size: 20px; color: #1e40af; margin-bottom: 4px; }
                .meta { font-size: 9px; color: #94a3b8; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
                td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 24px; text-align: center; font-size: 8px; color: #94a3b8; }
            </style>
        </head><body>
            <h1>{$title}</h1>
            <div class="meta">Generated: {$date} · BITAC PMS {$metaHtml}</div>
            {$body}
            <div class="footer">Generated by BITAC PMS AI Agent · {$date}</div>
        </body></html>
        HTML;
    }
}
