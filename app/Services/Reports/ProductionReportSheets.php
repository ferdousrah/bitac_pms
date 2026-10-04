<?php

namespace App\Services\Reports;

use App\Models\WorkOrder;
use App\Services\ReportSheetRenderer as R;

/**
 * The four shop-floor reports, described as printable sheets.
 *
 * ⚠️ Like IedReportSheets, these build a sheet from figures the report has
 * already worked out and compute nothing of their own.
 */
class ProductionReportSheets
{
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

    /** The window the report was run for. */
    private static function scope(array $filters, string ...$extra): string
    {
        $from = \Carbon\Carbon::parse($filters['from'])->format('d M Y');
        $to   = \Carbon\Carbon::parse($filters['to'])->format('d M Y');

        return implode(' &nbsp;·&nbsp; ', array_filter(array_merge(["{$from} – {$to}"], $extra)));
    }

    /** The status in BITAC's words, not the system's. */
    private static function statusLabel(?string $status): string
    {
        return self::esc((new WorkOrder(['status' => $status]))->status_label);
    }

    // ─────────────────────────────────────────────────────────────────────

    public static function production(array $data, array $filters): array
    {
        return [
            'title_bn' => 'উৎপাদন প্রতিবেদন',
            'title_en' => 'PRODUCTION REPORT',
            'landscape' => true,
            'subtitle' => self::scope($filters),
            'tiles' => [
                ['label' => 'Work orders', 'value' => R::money($data['total_wo'], 0)],
                ['label' => 'Delivered', 'value' => R::money($data['completed'], 0)],
                ['label' => 'In production', 'value' => R::money($data['in_production'], 0)],
                ['label' => 'Overdue', 'value' => R::money($data['overdue'], 0)],
            ],
            'sections' => [
                [
                    'heading' => '1. Month by month',
                    'columns' => [
                        ['label' => 'Month', 'width' => '60%'],
                        ['label' => 'Delivered', 'align' => 'right', 'width' => '20%'],
                        ['label' => 'In production', 'align' => 'right', 'width' => '20%'],
                    ],
                    'rows' => array_map(fn ($m) => [
                        self::esc($m['month']),
                        R::money($m['completed'], 0),
                        R::money($m['in_production'], 0),
                    ], self::rows($data['by_month'])),
                    'empty' => 'No work order raised in this window.',
                ],
                [
                    'heading' => '2. The work orders',
                    'columns' => [
                        ['label' => 'WO', 'width' => '14%'],
                        ['label' => 'Job', 'width' => '8%'],
                        ['label' => 'Product', 'width' => '18%'],
                        ['label' => 'Client', 'width' => '22%'],
                        ['label' => 'Qty', 'align' => 'right', 'width' => '7%'],
                        ['label' => 'Stage', 'width' => '15%'],
                        ['label' => 'Due', 'width' => '9%'],
                        ['label' => 'Lead days', 'align' => 'right', 'width' => '7%'],
                    ],
                    'rows' => array_map(fn ($w) => [
                        self::esc($w['wo_number']),
                        self::esc((string) ($w['job_number'] ?: '—')),
                        self::esc($w['product']),
                        self::esc($w['customer']),
                        R::money($w['quantity'], 0),
                        self::statusLabel($w['status']),
                        $w['due_date']
                            ? self::esc($w['due_date']) . ($w['is_overdue'] ? ' <b>late</b>' : '')
                            : '—',
                        // Null is "not delivered yet", which is not zero days.
                        $w['lead_time_days'] === null ? '—' : R::money($w['lead_time_days'], 0),
                    ], self::rows($data['work_orders'])),
                    'empty' => 'No work order raised in this window.',
                ],
            ],
            'notes' => 'Work orders are counted by the date they were raised. <b>Lead days</b> is from raising the '
                . 'work order to the delivery being confirmed; a job not yet delivered shows a dash rather than a zero.',
            'signatories' => ['Prepared By', 'Executive Engineer (PCD)', 'Director (Centre Head)'],
        ];
    }

    public static function oee(array $data, array $filters): array
    {
        return [
            'title_bn' => 'যন্ত্রপাতির সার্বিক কার্যকারিতা',
            'title_en' => 'OVERALL EQUIPMENT EFFECTIVENESS (OEE)',
            'landscape' => true,
            'subtitle' => self::scope($filters),
            'tiles' => [
                ['label' => 'OEE', 'value' => $data['oee'] . '%'],
                ['label' => 'Availability', 'value' => $data['availability'] . '%'],
                ['label' => 'Performance', 'value' => $data['performance'] . '%'],
                ['label' => 'Quality', 'value' => $data['quality'] . '%'],
            ],
            'sections' => [[
                'heading' => 'By machine',
                'columns' => [
                    ['label' => 'Machine', 'width' => '24%'],
                    ['label' => 'Work centre', 'width' => '20%'],
                    ['label' => 'Planned hrs', 'align' => 'right', 'width' => '12%'],
                    ['label' => 'Actual hrs', 'align' => 'right', 'width' => '12%'],
                    ['label' => 'Over plan', 'align' => 'right', 'width' => '12%'],
                    ['label' => 'Performance', 'align' => 'right', 'width' => '10%'],
                    ['label' => 'OEE', 'align' => 'right', 'width' => '10%'],
                ],
                'rows' => array_map(fn ($m) => [
                    self::esc($m['machine']),
                    self::esc($m['work_centre']),
                    R::money($m['available_hrs'], 1),
                    R::money($m['productive_hrs'], 1),
                    R::money($m['downtime_hrs'], 1),
                    $m['performance'] . '%',
                    $m['oee'] . '%',
                ], self::rows($data['by_machine'])),
                'empty' => 'No operation finished on a machine in this window.',
            ]],
            // No warning glyph in PRINTED text: it is in neither Tinos nor
            // Nikosh, so mPDF substitutes DejaVu and the sheet then carries a
            // third face. Warnings belong in the code, not on BITAC paper.
            'notes' => '<b>Note:</b> this is OEE from the signals the system actually captures, not from shift clocks. '
                . '<b>Performance</b> is planned hours ÷ actual hours on finished operations, '
                . '<b>availability</b> is the share of steps that finished without being sent back, and '
                . '<b>quality</b> is QC passes ÷ inspections. Real downtime tracking would change these figures.',
            'signatories' => ['Prepared By', 'Executive Engineer (PCD)', 'Director (Centre Head)'],
        ];
    }

    public static function leadTime(array $data, array $filters): array
    {
        return [
            'title_bn' => 'কাজ সম্পাদনের সময়',
            'title_en' => 'LEAD TIME REPORT',
            'landscape' => true,
            'subtitle' => self::scope($filters, 'delivered jobs only'),
            'tiles' => [
                ['label' => 'Average lead', 'value' => $data['avg_lead_time'] . ' days'],
                ['label' => 'Fastest', 'value' => $data['min_lead_time'] . ' days'],
                ['label' => 'Slowest', 'value' => $data['max_lead_time'] . ' days'],
                ['label' => 'Jobs delivered', 'value' => R::money(count(self::rows($data['work_orders'])), 0)],
            ],
            'sections' => [
                [
                    'heading' => '1. By product',
                    'columns' => [
                        ['label' => 'Product', 'width' => '50%'],
                        ['label' => 'Jobs', 'align' => 'right', 'width' => '16%'],
                        ['label' => 'Average days', 'align' => 'right', 'width' => '17%'],
                        ['label' => 'On time', 'align' => 'right', 'width' => '17%'],
                    ],
                    'rows' => array_map(fn ($p) => [
                        self::esc($p['product']),
                        R::money($p['count'], 0),
                        R::money($p['avg_lead'], 1),
                        R::money($p['on_time'], 0) . ' of ' . R::money($p['count'], 0),
                    ], self::rows($data['by_product'])),
                    'empty' => 'Nothing was delivered in this window.',
                ],
                [
                    'heading' => '2. Job by job',
                    'columns' => [
                        ['label' => 'WO', 'width' => '16%'],
                        ['label' => 'Product', 'width' => '20%'],
                        ['label' => 'Client', 'width' => '24%'],
                        ['label' => 'Raised', 'width' => '12%'],
                        ['label' => 'Delivered', 'width' => '12%'],
                        ['label' => 'Days', 'align' => 'right', 'width' => '8%'],
                        ['label' => 'On time', 'align' => 'right', 'width' => '8%'],
                    ],
                    'rows' => array_map(fn ($w) => [
                        self::esc($w['wo_number']),
                        self::esc($w['product']),
                        self::esc($w['customer']),
                        self::esc($w['created_at']),
                        self::esc($w['delivered_at']),
                        R::money($w['lead_days'], 0),
                        $w['was_on_time'] ? 'yes' : '<b>no</b>',
                    ], self::rows($data['work_orders'])),
                    'empty' => 'Nothing was delivered in this window.',
                ],
            ],
            'notes' => 'Lead time runs from the work order being raised to the delivery being confirmed. '
                . 'A job with no due date recorded counts as on time, because there is nothing to have missed.',
            'signatories' => ['Prepared By', 'Executive Engineer (PCD)', 'Director (Centre Head)'],
        ];
    }

    public static function rejectionRate(array $data, array $filters): array
    {
        return [
            'title_bn' => 'বাতিলের হার',
            'title_en' => 'REJECTION RATE',
            'subtitle' => self::scope($filters),
            'tiles' => [
                ['label' => 'Inspections', 'value' => R::money($data['total_inspections'], 0)],
                ['label' => 'Passed', 'value' => R::money($data['total_passed'], 0)],
                ['label' => 'Conditional', 'value' => R::money($data['total_conditional'], 0)],
                ['label' => 'Failed', 'value' => R::money($data['total_failed'], 0)],
                ['label' => 'Rejection rate', 'value' => $data['rejection_rate'] . '%'],
                ['label' => 'Open NCRs', 'value' => R::money($data['open_ncrs'], 0)],
            ],
            'sections' => [
                [
                    'heading' => '1. Top defects',
                    'columns' => [
                        ['label' => 'Defect', 'width' => '78%'],
                        ['label' => 'Raised', 'align' => 'right', 'width' => '22%'],
                    ],
                    'rows' => array_map(fn ($d) => [
                        self::esc($d['type']),
                        R::money($d['count'], 0),
                    ], self::rows($data['by_defect_type'])),
                    'empty' => 'No NCR raised in this window.',
                ],
                [
                    'heading' => '2. By product',
                    'columns' => [
                        ['label' => 'Product', 'width' => '52%'],
                        ['label' => 'Inspections', 'align' => 'right', 'width' => '16%'],
                        ['label' => 'Failed', 'align' => 'right', 'width' => '16%'],
                        ['label' => 'Rate', 'align' => 'right', 'width' => '16%'],
                    ],
                    'rows' => array_map(fn ($p) => [
                        self::esc($p['product']),
                        R::money($p['total'], 0),
                        R::money($p['failed'], 0),
                        $p['rate'] . '%',
                    ], self::rows($data['by_product'])),
                    'empty' => 'No inspection in this window.',
                ],
            ],
            'notes' => '<b>Open NCRs</b> is a running figure for the whole system, not for this window — an NCR '
                . 'raised earlier and still open is still open. A conditional pass is counted as a pass.',
            'signatories' => ['Prepared By', 'QC Inspector', 'Director (Centre Head)'],
        ];
    }
}
