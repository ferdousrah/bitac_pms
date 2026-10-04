<?php

namespace App\Services\Reports;

use App\Services\ReportSheetRenderer as R;

/**
 * IED's five commercial reports, described as printable sheets.
 *
 * ⚠️ These build a sheet from data the report has ALREADY worked out — they
 * compute nothing. A printed total that disagrees with the screen is the one
 * failure nobody can explain away, and a second copy of the arithmetic here is
 * exactly how that happens.
 *
 * ⚠️ No ৳ inside a figure column — see ReportSheetRenderer. The unit is stated
 * once in the subtitle.
 */
class IedReportSheets
{
    /** The line under the title saying what was asked for. */
    private static function scope(string $yearLabel, ?string $centre, string ...$extra): string
    {
        $parts = array_filter(array_merge([
            'Financial year ' . $yearLabel,
            $centre ?: 'all centres',
            'amounts in BDT (<span class="bn">৳</span>)',
        ], $extra));

        return implode(' &nbsp;·&nbsp; ', $parts);
    }

    /**
     * ⚠️ A report hands over Eloquent Collections as often as arrays
     * (`$byMonth`, `$workOrders`, …). Normalise once here rather than guessing
     * at each call site — `array_map` and `array_column` both die on a
     * Collection, and they die at print time, not on the screen.
     */
    private static function rows(mixed $rows): array
    {
        return collect($rows)->map(fn ($r) => is_array($r) ? $r : (array) $r)->values()->all();
    }

    private static function esc(?string $v): string
    {
        return htmlspecialchars((string) $v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    // ─────────────────────────────────────────────────────────────────────

    public static function clients(string $yearLabel, ?string $centre, array $rows, ?string $search = null): array
    {
        return [
            'title_bn' => 'গ্রাহক তালিকা',
            'title_en' => 'CLIENT LIST',
            'subtitle' => self::scope($yearLabel, $centre,
                $search ? 'matching “' . self::esc($search) . '”' : ''),
            'tiles' => [
                ['label' => 'Clients', 'value' => (string) count(self::rows($rows))],
                ['label' => 'Jobs', 'value' => R::money(array_sum(array_column(self::rows($rows), 'jobs')), 0)],
                ['label' => 'Value', 'value' => R::money(array_sum(array_column(self::rows($rows), 'value')))],
            ],
            'sections' => [[
                'heading' => 'Clients, biggest first',
                'columns' => [
                    ['label' => 'Client', 'width' => '30%'],
                    ['label' => 'Type', 'width' => '14%'],
                    ['label' => 'Sector', 'width' => '16%'],
                    ['label' => 'Contact', 'width' => '18%'],
                    ['label' => 'Jobs', 'align' => 'right', 'width' => '8%'],
                    ['label' => 'Value', 'align' => 'right', 'width' => '14%'],
                ],
                'rows' => array_map(fn ($r) => [
                    self::esc($r['name']),
                    // ⚠️ Unclassified clients are shown, not hidden — a gap in
                    // the data must never read as a gap in the work.
                    self::esc($r['type_label'] ?: 'Unspecified'),
                    self::esc($r['sector'] ?: '—'),
                    self::esc($r['contact'] ?: '—'),
                    R::money($r['jobs'], 0),
                    R::money($r['value']),
                ], self::rows($rows)),
                'total' => ['Total', '', '', '',
                    R::money(array_sum(array_column(self::rows($rows), 'jobs')), 0),
                    R::money(array_sum(array_column(self::rows($rows), 'value')))],
                'empty' => 'No client has a job in this year.',
            ]],
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    public static function sector(string $yearLabel, ?string $centre, array $groups): array
    {
        // Government / Private as a bold band, its sectors beneath it.
        $rows = [];
        foreach (self::rows($groups) as $group) {
            $rows[] = [
                '<b>' . self::esc($group['type_label']) . '</b>',
                '<b>' . R::money($group['jobs'], 0) . '</b>',
                '<b>' . R::money($group['value']) . '</b>',
            ];
            foreach (self::rows($group['sectors']) as $sector) {
                $rows[] = [
                    '<span style="padding-left: 12pt;">' . self::esc($sector['sector'] ?: 'Unclassified') . '</span>',
                    R::money($sector['jobs'], 0),
                    R::money($sector['value']),
                ];
            }
        }

        return [
            'title_bn' => 'ধরন ও খাতভিত্তিক কাজ',
            'title_en' => 'JOBS BY CLIENT TYPE & SECTOR',
            'subtitle' => self::scope($yearLabel, $centre),
            'tiles' => [
                ['label' => 'Jobs', 'value' => R::money(array_sum(array_column(self::rows($groups), 'jobs')), 0)],
                ['label' => 'Value', 'value' => R::money(array_sum(array_column(self::rows($groups), 'value')))],
            ],
            'sections' => [[
                'heading' => 'By type, then sector',
                'caption' => 'Clients with no type or sector recorded appear as Unspecified — a gap in the '
                    . 'classification is not a gap in the work.',
                'columns' => [
                    ['label' => 'Type / Sector', 'width' => '56%'],
                    ['label' => 'Jobs', 'align' => 'right', 'width' => '14%'],
                    ['label' => 'Value', 'align' => 'right', 'width' => '30%'],
                ],
                'rows'  => $rows,
                'total' => ['Total',
                    R::money(array_sum(array_column(self::rows($groups), 'jobs')), 0),
                    R::money(array_sum(array_column(self::rows($groups), 'value')))],
                'empty' => 'No job in this year.',
            ]],
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    public static function quotationValue(string $yearLabel, ?string $centre, array $data): array
    {
        $rate = $data['value'] > 0 ? round(($data['converted_value'] / $data['value']) * 100, 1) : 0.0;

        return [
            'title_bn' => 'দরপত্রের মূল্যমান',
            'title_en' => 'QUOTATION VALUE',
            'subtitle' => self::scope($yearLabel, $centre),
            'tiles' => [
                ['label' => 'Quotations given', 'value' => R::money($data['count'], 0)],
                ['label' => 'Value quoted', 'value' => R::money($data['value'])],
                ['label' => 'Turned into work', 'value' => R::money($data['converted_count'], 0)],
                ['label' => 'Value won', 'value' => R::money($data['converted_value'])],
                ['label' => 'Conversion', 'value' => $rate . '%'],
            ],
            'sections' => [[
                'heading' => 'Month by month',
                'columns' => [
                    ['label' => 'Month', 'width' => '50%'],
                    ['label' => 'Quotations', 'align' => 'right', 'width' => '20%'],
                    ['label' => 'Value', 'align' => 'right', 'width' => '30%'],
                ],
                'rows' => array_map(fn ($m) => [
                    self::esc($m['label']),
                    R::money($m['count'], 0),
                    R::money($m['value']),
                ], self::rows($data['monthly'])),
                'total' => ['Total', R::money($data['count'], 0), R::money($data['value'])],
                'empty' => 'No quotation reached a customer in this year.',
            ]],
            'notes' => 'Counts quotations that actually <b>reached the customer</b> — drafts and those still '
                . 'awaiting approval are not counted, because they were never given. A quotation that has been '
                . 'revised is counted once, as the version that stands.',
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    public static function pipeline(?string $centre, array $data): array
    {
        $stageRows = array_map(fn ($s) => [
            self::esc($s['label']),
            R::money($s['jobs'], 0),
            R::money($s['value']),
        ], self::rows($data['stages']));

        $jobRows = array_map(function ($j) {
            $reference = $j['kind'] === 'quotation'
                ? ($j['quotation']['ref'] ?? '—') . ($j['rfq_id'] ? ' · RFQ #' . $j['rfq_id'] : '')
                : $j['wo_number'] . ($j['job_number'] ? ' · Job ' . $j['job_number'] : '');

            $quotation = $j['quotation']
                ? $j['quotation']['ref'] . ($j['quotation']['version'] > 1 ? ' v' . $j['quotation']['version'] : '')
                : '<i>not quoted</i>';

            return [
                self::esc($reference),
                self::esc($j['customer'] ?: '—'),
                self::esc($j['stage_label']),
                $quotation,
                $j['due_date'] ? self::esc($j['due_date']) . ($j['overdue'] ? ' <b>overdue</b>' : '') : '—',
                // ⚠️ A job with no quotation has an UNKNOWN value, not a zero one.
                $j['quotation'] ? R::money($j['value']) : '—',
            ];
        }, $data['jobs']);

        return [
            'title_bn' => 'চলমান কাজের বিবরণী',
            'title_en' => 'JOBS IN PIPELINE',
            'landscape' => true,
            'subtitle' => implode(' &nbsp;·&nbsp; ', array_filter([
                'As on ' . now()->format('d F Y'),
                $centre ?: 'all centres',
                'amounts in BDT (<span class="bn">৳</span>)',
            ])),
            'tiles' => [
                ['label' => 'In the pipeline', 'value' => R::money($data['total']['jobs'], 0)],
                ['label' => 'Quoted', 'value' => R::money($data['total']['quoted'], 0)],
                ['label' => 'Work orders', 'value' => R::money($data['total']['work_orders'], 0)],
                ['label' => 'Quoted value', 'value' => R::money($data['total']['value'])],
            ],
            'sections' => [
                [
                    'heading' => '1. By stage',
                    'columns' => [
                        ['label' => 'Stage', 'width' => '60%'],
                        ['label' => 'Items', 'align' => 'right', 'width' => '15%'],
                        ['label' => 'Quoted value', 'align' => 'right', 'width' => '25%'],
                    ],
                    'rows'  => $stageRows,
                    'total' => ['Total', R::money($data['total']['jobs'], 0), R::money($data['total']['value'])],
                ],
                [
                    'heading' => '2. What is in it',
                    'columns' => [
                        ['label' => 'Reference', 'width' => '18%'],
                        ['label' => 'Client', 'width' => '28%'],
                        ['label' => 'Stage', 'width' => '16%'],
                        ['label' => 'Quotation', 'width' => '13%'],
                        ['label' => 'Due', 'width' => '12%'],
                        ['label' => 'Quoted value', 'align' => 'right', 'width' => '13%'],
                    ],
                    'rows'  => $jobRows,
                    'empty' => 'Nothing open.',
                ],
            ],
            'notes' => 'Everything neither delivered nor cancelled, from the quotation to the gate. '
                . '<b>Quoted</b> is work quoted to a customer against which no work order has come in yet. '
                . 'A work order carries no money of its own — the figure is the quotation it was issued against, '
                . 'so a job with no quotation shows a dash and is left out of the total'
                . (($data['total']['unquoted'] ?? 0) > 0
                    ? ' (' . $data['total']['unquoted'] . ' such job(s) here).'
                    : '.'),
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    public static function target(string $yearLabel, ?string $centre, array $data): array
    {
        $totals = $data['totals'];
        $pct = $totals['target'] > 0 ? round(($totals['achieved'] / $totals['target']) * 100, 1) : null;

        return [
            'title_bn' => 'লক্ষ্যমাত্রা ও অর্জন',
            'title_en' => 'TARGET VS ACHIEVEMENT',
            'subtitle' => self::scope($yearLabel, $centre),
            'tiles' => [
                ['label' => 'Target', 'value' => $totals['target'] > 0 ? R::money($totals['target']) : 'not set'],
                ['label' => 'Achieved', 'value' => R::money($totals['achieved'])],
                ['label' => 'Progress', 'value' => $pct === null ? '—' : $pct . '%'],
                ['label' => 'Work orders', 'value' => R::money($totals['work_orders'], 0)],
            ],
            'sections' => [[
                'heading' => 'By centre',
                'columns' => [
                    ['label' => 'Centre', 'width' => '30%'],
                    ['label' => 'Target', 'align' => 'right', 'width' => '18%'],
                    ['label' => 'Achieved', 'align' => 'right', 'width' => '18%'],
                    ['label' => 'Progress', 'align' => 'right', 'width' => '12%'],
                    ['label' => 'Gap', 'align' => 'right', 'width' => '14%'],
                    ['label' => 'WOs', 'align' => 'right', 'width' => '8%'],
                ],
                'rows' => array_map(fn ($r) => [
                    self::esc($r['center']),
                    $r['target'] > 0 ? R::money($r['target']) : '<i>not set</i>',
                    R::money($r['achieved']),
                    $r['target'] > 0 ? $r['percent'] . '%' : '—',
                    $r['target'] > 0 ? R::money(abs($r['gap'])) : '—',
                    R::money($r['work_orders'], 0),
                ], self::rows($data['rows'])),
                'total' => ['Total',
                    R::money($totals['target']),
                    R::money($totals['achieved']),
                    $pct === null ? '—' : $pct . '%',
                    R::money(abs($totals['target'] - $totals['achieved'])),
                    R::money($totals['work_orders'], 0)],
                'empty' => 'No centre to show.',
            ]],
            'notes' => 'Achievement is the value of work orders received, taken from the quotation each one was '
                . 'issued against, and counted in the financial year of the <b>customer\'s own work-order date</b> '
                . '— not the date it was entered. Cancelled work orders are excluded.',
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }
}
