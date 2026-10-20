<?php

namespace App\Services\Reports;

use App\Services\ReportSheetRenderer as R;

/**
 * IED's reports (Stakeholders, Sector Wise Job, Quotation Value, Jobs in Pipeline,
 * Target vs Achievement, Factory Visited, Factory to be Visited), as printable sheets.
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
            'title_bn' => 'স্টেকহোল্ডার তালিকা',
            'title_en' => 'STAKEHOLDERS',
            'subtitle' => self::scope($yearLabel, $centre,
                $search ? 'matching “' . self::esc($search) . '”' : ''),
            'tiles' => [
                ['label' => 'Stakeholders', 'value' => (string) count(self::rows($rows))],
                ['label' => 'Jobs', 'value' => R::money(array_sum(array_column(self::rows($rows), 'jobs')), 0)],
                ['label' => 'Value', 'value' => R::money(array_sum(array_column(self::rows($rows), 'value')))],
            ],
            'sections' => [[
                'heading' => 'Stakeholders, biggest first',
                'columns' => [
                    ['label' => 'Stakeholder', 'width' => '30%'],
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
                'empty' => 'No stakeholder has a job in this year.',
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
            'title_bn' => 'খাতভিত্তিক কাজ',
            'title_en' => 'SECTOR WISE JOB',
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
            'notes' => 'Each job is counted <b>once, at the price that stands</b>: after a re-quotation is given, '
                . 'at the re-quotation\'s price, and the earlier version is not counted. Drafts and quotations '
                . 'awaiting approval are not counted, because they were never given.',
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    /**
     * Jobs in Pipeline — quotations given to a client with no order yet
     * (BITAC, 2026-10-20). Not year-scoped: "as on" today.
     */
    public static function pipeline(?string $centre, array $data): array
    {
        $summary = fn (array $groups) => array_map(fn ($g) => [
            self::esc($g['label']),
            R::money($g['jobs'], 0),
            R::money($g['value']),
        ], self::rows($groups));

        $jobRows = array_map(function ($j) {
            $q = $j['quotation'];
            $ref = $q['ref'] . ($q['version'] > 1 ? ' v' . $q['version'] : '')
                . ($q['memo_no'] ? '<br><span style="font-size: 7.5pt;">' . self::esc($q['memo_no']) . '</span>' : '');
            $job = self::esc($j['job'] ?: '—') . ($j['more_items'] > 0 ? ' <i>+' . $j['more_items'] . ' more</i>' : '');

            return [
                $ref,
                self::esc($j['customer'] ?: '—'),
                $job,
                $j['quoted_on'] ? self::esc(date('d M Y', strtotime($j['quoted_on']))) : '—',
                $j['days'] !== null ? R::money($j['days'], 0) : '—',
                self::esc($j['state_label']),
                R::money($j['value']),
            ];
        }, self::rows($data['jobs']));

        $totalRow = fn () => ['Total', R::money($data['total']['jobs'], 0), R::money($data['total']['value'])];
        $col3 = [
            ['label' => '', 'width' => '60%'],
            ['label' => 'Jobs', 'align' => 'right', 'width' => '15%'],
            ['label' => 'Quoted value', 'align' => 'right', 'width' => '25%'],
        ];

        return [
            'title_bn' => 'পাইপলাইনে থাকা কাজ',
            'title_en' => 'JOBS IN PIPELINE',
            'landscape' => true,
            'subtitle' => implode(' &nbsp;·&nbsp; ', array_filter([
                'As on ' . now()->format('d F Y'),
                $centre ?: 'all centres',
                'amounts in BDT (<span class="bn">৳</span>)',
            ])),
            'tiles' => [
                ['label' => 'Quoted, no order yet', 'value' => R::money($data['total']['jobs'], 0)],
                ['label' => 'Quoted value', 'value' => R::money($data['total']['value'])],
                ['label' => 'Longest waiting', 'value' => $data['total']['oldest_days'] !== null
                    ? R::money($data['total']['oldest_days'], 0) . ' days' : '—'],
            ],
            'sections' => [
                [
                    'heading' => '1. Where they stand',
                    'columns' => array_replace($col3, [0 => ['label' => 'Status', 'width' => '60%']]),
                    'rows'    => $summary($data['by_state']),
                    'total'   => $totalRow(),
                ],
                [
                    'heading' => '2. How long they have been waiting',
                    'columns' => array_replace($col3, [0 => ['label' => 'Since quoted', 'width' => '60%']]),
                    'rows'    => $summary($data['ageing']),
                    'total'   => $totalRow(),
                ],
                [
                    'heading' => '3. The quotations, longest waiting first',
                    'columns' => [
                        ['label' => 'Quotation', 'width' => '13%'],
                        ['label' => 'Stakeholder', 'width' => '20%'],
                        ['label' => 'Job', 'width' => '25%'],
                        ['label' => 'Quoted on', 'width' => '10%'],
                        ['label' => 'Days', 'align' => 'right', 'width' => '6%'],
                        ['label' => 'Status', 'width' => '14%'],
                        ['label' => 'Quoted value', 'align' => 'right', 'width' => '12%'],
                    ],
                    'rows'  => $jobRows,
                    'total' => ['Total', '', '', '', '', '', R::money($data['total']['value'])],
                    'empty' => 'No quotation is waiting for an order.',
                ],
            ],
            'notes' => 'A job is here when a quotation has been <b>given to the client and no order has come in</b>. '
                . 'Each job appears once, at the price the client is holding: after a re-quotation is sent, at the '
                . 're-quotation\'s price; while one is being prepared, at the earlier price. Once a work order is '
                . 'received the job leaves this report.',
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    /** Factory Visited (পরিদর্শিত কারখানা). */
    public static function factoryVisited(string $yearLabel, ?string $centre, array $data): array
    {
        $rows = []; $sl = 0;
        foreach (self::rows($data['visits']) as $v) {
            $rows[] = [
                (string) ++$sl,
                self::esc($v['factory_name']),
                self::esc($v['visitors']),
                nl2br(self::esc($v['visit_work'] ?? '')) ?: '—',
                self::esc(date('d M Y', strtotime($v['date']))),
                nl2br(self::esc($v['remarks'] ?? '')) ?: '—',
            ];
        }

        return [
            'title_bn' => 'পরিদর্শিত কারখানা',
            'title_en' => 'FACTORY VISITED',
            'landscape' => true,
            'subtitle' => 'Financial year ' . $yearLabel . ' &nbsp;·&nbsp; ' . ($centre ?: 'all centres'),
            'tiles' => [
                ['label' => 'Visits', 'value' => R::money($data['total']['visits'], 0)],
                ['label' => 'Factories', 'value' => R::money($data['total']['factories'], 0)],
            ],
            'sections' => [
                self::monthSection('1. Month by month', $data, 'Visits'),
                [
                    'heading' => '2. The visits',
                    'columns' => [
                        ['label' => 'Sl', 'align' => 'right', 'width' => '5%'],
                        ['label' => 'Name of Factory', 'width' => '20%'],
                        ['label' => 'Visitors', 'width' => '19%'],
                        ['label' => 'Visited Work', 'width' => '28%'],
                        ['label' => 'Date', 'width' => '10%'],
                        ['label' => 'Remarks', 'width' => '18%'],
                    ],
                    'rows'  => $rows,
                    'empty' => 'No factory visit recorded in this year.',
                ],
            ],
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    /** Factory to be Visited (পরিদর্শিতব্য কারখানা). */
    public static function factoryToVisit(string $yearLabel, ?string $centre, array $data): array
    {
        $rows = []; $sl = 0;
        foreach (self::rows($data['visits']) as $v) {
            $rows[] = [
                (string) ++$sl,
                self::esc($v['factory_name']),
                self::esc($v['visitors']),
                self::esc(date('d M Y', strtotime($v['date']))) . (! empty($v['overdue']) ? '<br><i>date passed</i>' : ''),
                nl2br(self::esc($v['remarks'] ?? '')) ?: '—',
            ];
        }

        return [
            'title_bn' => 'পরিদর্শিতব্য কারখানা',
            'title_en' => 'FACTORY TO BE VISITED',
            'subtitle' => 'Financial year ' . $yearLabel . ' &nbsp;·&nbsp; ' . ($centre ?: 'all centres'),
            'tiles' => array_values(array_filter([
                ['label' => 'Visits planned', 'value' => R::money($data['total']['visits'], 0)],
                ['label' => 'Factories', 'value' => R::money($data['total']['factories'], 0)],
                $data['total']['overdue'] > 0 ? ['label' => 'Date passed', 'value' => R::money($data['total']['overdue'], 0)] : null,
            ])),
            'sections' => [
                self::monthSection('1. Month by month', $data, 'Planned'),
                [
                    'heading' => '2. The planned visits',
                    'columns' => [
                        ['label' => 'Sl', 'align' => 'right', 'width' => '6%'],
                        ['label' => 'Name of Factory to be Visited', 'width' => '30%'],
                        ['label' => 'Visitors', 'width' => '26%'],
                        ['label' => 'Date', 'width' => '14%'],
                        ['label' => 'Remarks', 'width' => '24%'],
                    ],
                    'rows'  => $rows,
                    'empty' => 'No factory visit planned in this year.',
                ],
            ],
            'notes' => 'Visits that have taken place are not listed here — they are in the Factory Visited report.',
            'signatories' => ['Prepared By', 'Executive Engineer (IED)', 'Director (Centre Head)'],
        ];
    }

    /** Every month of the financial year — empty ones too — with its count. */
    private static function monthSection(string $heading, array $data, string $countLabel): array
    {
        return [
            'heading' => $heading,
            'caption' => 'A factory visited in more than one month is counted once in the year’s Factories total.',
            'columns' => [
                ['label' => 'Month', 'width' => '50%'],
                ['label' => $countLabel, 'align' => 'right', 'width' => '25%'],
                ['label' => 'Factories', 'align' => 'right', 'width' => '25%'],
            ],
            'rows' => array_map(fn ($m) => [
                self::esc($m['label']),
                $m['visits'] ? R::money($m['visits'], 0) : '—',
                $m['factories'] ? R::money($m['factories'], 0) : '—',
            ], self::rows($data['months'])),
            'total' => ['Total', R::money($data['total']['visits'], 0), R::money($data['total']['factories'], 0)],
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
