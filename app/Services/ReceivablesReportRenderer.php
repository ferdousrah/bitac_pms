<?php

namespace App\Services;

use App\Services\ReportSheetRenderer as R;

/**
 * The receivables report, printed.
 *
 * ⚠️ It renders whatever `ReceivablesController::build()` hands it and
 * computes nothing of its own. A printed total that disagrees with the screen
 * is the one failure nobody can explain away.
 *
 * ⚠️ **Landscape.** Seven money columns plus a client name do not fit A4
 * portrait without wrapping, and a receivables figure that wraps is a figure
 * nobody can read down a column.
 *
 * Two tables, because they answer two different questions: what each client
 * owes, and how old it is. The classic receivables sheet carries both.
 *
 * This describes a sheet and lets ReportSheetRenderer lay it out, like every
 * other report — it used to carry its own copy of the table CSS, which is how
 * one sheet quietly stops looking like the rest.
 */
class ReceivablesReportRenderer
{
    public function render(array $data): string
    {
        $rows   = collect($data['rows']);
        $totals = $data['totals'];
        $ageing = $data['ageing'];

        return app(ReportSheetRenderer::class)->render([
            'title_bn'  => 'বকেয়া পাওনার বিবরণী',
            'title_en'  => 'STATEMENT OF RECEIVABLES',
            'landscape' => true,
            'subtitle'  => $this->subtitle($data['filters']),
            'tiles' => [
                ['label' => 'Billed', 'value' => R::money($totals['billed'])],
                ['label' => 'Settled', 'value' => R::money($totals['settled'])],
                ['label' => 'Due', 'value' => R::money($totals['due'])],
                ['label' => 'Overdue', 'value' => R::money($totals['overdue'])],
                ['label' => 'Security held', 'value' => R::money($totals['security_held'])],
                ['label' => 'Advance in hand', 'value' => R::money($totals['advance_available'])],
                ['label' => 'Net receivable', 'value' => R::money($totals['net_receivable'])],
            ],
            'sections' => [
                $this->outstandingSection($rows, $totals),
                $this->ageingSection($rows, $ageing),
            ],
            'notes' => '<b>Security held</b> is money the client has withheld from a payment and has not yet '
                . 'returned — it is part of the Due, not additional to it. '
                . '<b>Advance in hand</b> is the client\'s money already received against a job that no bill has '
                . 'drawn on yet; <b>Net receivable</b> is the Due less that advance. '
                . 'Income tax and VAT deducted at source are not shown as dues — they reach the treasury against '
                . 'a challan and settle the bill.',
            'signatories' => ['Prepared By', 'Accounts Officer', 'Director (Centre Head)'],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────

    private function subtitle(array $filters): string
    {
        $scope = [];
        if (! empty($filters['search'])) {
            $scope[] = 'client matching “' . $this->esc($filters['search']) . '”';
        }
        $scope[] = ! empty($filters['only_due'])
            ? 'only clients with money outstanding'
            : 'every client with a bill';

        return 'As on ' . now()->format('d F Y')
            . ' &nbsp;·&nbsp; all amounts in BDT (<span class="bn">৳</span>)'
            . ' &nbsp;·&nbsp; ' . implode(' &nbsp;·&nbsp; ', $scope);
    }

    private function outstandingSection($rows, array $totals): array
    {
        return [
            'heading' => '1. Outstanding by client',
            'columns' => [
                ['label' => 'Client', 'width' => '24%'],
                ['label' => 'Bills', 'align' => 'center', 'width' => '5%'],
                ['label' => 'Billed', 'align' => 'right', 'width' => '10%'],
                ['label' => 'Settled', 'align' => 'right', 'width' => '10%'],
                ['label' => 'Due', 'align' => 'right', 'width' => '10%'],
                ['label' => 'Overdue', 'align' => 'right', 'width' => '9%'],
                ['label' => 'Security held', 'align' => 'right', 'width' => '11%'],
                ['label' => 'Advance in hand', 'align' => 'right', 'width' => '11%'],
                ['label' => 'Net receivable', 'align' => 'right', 'width' => '10%'],
            ],
            'rows' => $rows->map(fn ($row) => [
                $this->esc($row['customer']),
                (string) $row['invoice_count'],
                R::money($row['billed']),
                R::money($row['settled']),
                '<b>' . R::money($row['due']) . '</b>',
                $row['overdue'] > 0 ? R::money($row['overdue']) : '—',
                $row['security_held'] > 0 ? R::money($row['security_held']) : '—',
                $row['advance_available'] > 0 ? R::money($row['advance_available']) : '—',
                '<b>' . R::money($row['net_receivable']) . '</b>',
            ])->values()->all(),
            'total' => [
                'Total', '',
                R::money($totals['billed']),
                R::money($totals['settled']),
                R::money($totals['due']),
                R::money($totals['overdue']),
                R::money($totals['security_held']),
                R::money($totals['advance_available']),
                R::money($totals['net_receivable']),
            ],
            'empty' => 'Nothing outstanding — every bill is settled.',
        ];
    }

    private function ageingSection($rows, array $ageing): array
    {
        $buckets = PaymentLedger::BUCKETS;
        $labels  = PaymentLedger::BUCKET_LABELS;

        // Clients with nothing outstanding have no ageing to show; printing a
        // row of dashes for them only makes the sheet longer.
        $withDue = $rows->filter(fn ($r) => $r['due'] > PaymentLedger::TOLERANCE)->values();

        $columns = [['label' => 'Client', 'width' => '30%']];
        foreach ($buckets as $bucket) {
            $columns[] = ['label' => $labels[$bucket], 'align' => 'right', 'width' => '12%'];
        }
        $columns[] = ['label' => 'Total due', 'align' => 'right', 'width' => '10%'];

        $total = ['Total'];
        foreach ($buckets as $bucket) {
            $total[] = R::money((float) ($ageing[$bucket] ?? 0));
        }
        $total[] = R::money(array_sum($ageing));

        return [
            'heading' => '2. Ageing of the dues — from ' . PaymentLedger::CREDIT_DAYS
                . ' days after a bill was issued',
            'columns' => $columns,
            'rows' => $withDue->map(function ($row) use ($buckets) {
                $cells = [$this->esc($row['customer'])];
                foreach ($buckets as $bucket) {
                    $value = (float) ($row['ageing'][$bucket] ?? 0);
                    $cells[] = $value > 0 ? R::money($value) : '—';
                }
                $cells[] = '<b>' . R::money($row['due']) . '</b>';

                return $cells;
            })->values()->all(),
            'total' => $total,
            'empty' => 'No dues to age.',
        ];
    }

    private function esc(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
