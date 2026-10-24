<?php

namespace App\Services\Reports;

use App\Services\ReportSheetRenderer;
use App\Services\ReportSheetRenderer as R;

/**
 * Delivered vs Received, printed. Formats what
 * DeliveryCollectionController::build() worked out — computes nothing.
 * Landscape: eight money columns do not fit portrait without wrapping.
 */
class DeliveryCollectionSheet
{
    public function render(array $data): string
    {
        $t = $data['totals'];

        return app(ReportSheetRenderer::class)->render([
            'title_bn'  => 'সরবরাহকৃত মূল্য বনাম প্রাপ্ত অর্থ',
            'title_en'  => 'DELIVERED VS RECEIVED',
            'landscape' => true,
            'subtitle'  => $this->subtitle($data['filters']),
            'tiles' => [
                ['label' => 'Delivered value', 'value' => R::money($t['delivered_value'])],
                ['label' => 'Billed', 'value' => R::money($t['billed'])],
                ['label' => 'Received', 'value' => R::money($t['received'])],
                ['label' => 'Deducted at source', 'value' => R::money($t['at_source'])],
                ['label' => 'Gap', 'value' => R::money($t['gap'])],
                ['label' => 'Not yet billed', 'value' => R::money($t['not_billed'])],
            ],
            'sections' => [$this->clientSection($data['clients'], $t), $this->jobSection($data['rows'], $t)],
            'notes' => '<b>Delivered value</b> is each job\'s quotation total in proportion to the quantity delivered. '
                . '<b>Received</b> is cash from the client — bill payments net of deductions, security released and advances. '
                . '<b>Deducted at source</b> is income tax / VAT the client cut and deposited against a challan; it counts as paid. '
                . '<b>Gap</b> = Delivered value − Received − Deducted at source, and includes any <b>security</b> the client still holds. '
                . 'A negative gap means more was received than delivered (an advance).',
            'signatories' => ['Prepared By', 'Accounts Officer', 'Director (Centre Head)'],
        ]);
    }

    private function subtitle(array $f): string
    {
        $period = ($f['from'] || $f['to'])
            ? 'Period ' . ($f['from'] ? date('d M Y', strtotime($f['from'])) : 'start') . ' – ' . ($f['to'] ? date('d M Y', strtotime($f['to'])) : 'today')
            : 'All jobs to ' . now()->format('d F Y');
        $scope = [$period, 'all amounts in BDT (<span class="bn">৳</span>)'];
        if ($f['customer']) $scope[] = 'client: ' . e($f['customer']);
        if ($f['search'] !== '') $scope[] = 'matching “' . e($f['search']) . '”';

        return implode(' &nbsp;·&nbsp; ', $scope);
    }

    private function moneyCols(): array
    {
        return [
            ['label' => 'Delivered value', 'align' => 'right', 'width' => '11%'],
            ['label' => 'Billed', 'align' => 'right', 'width' => '10%'],
            ['label' => 'Received', 'align' => 'right', 'width' => '10%'],
            ['label' => 'At source', 'align' => 'right', 'width' => '9%'],
            ['label' => 'Security held', 'align' => 'right', 'width' => '9%'],
            ['label' => 'Gap', 'align' => 'right', 'width' => '10%'],
        ];
    }

    private function moneyCells(array $r): array
    {
        return [
            R::money($r['delivered_value']), R::money($r['billed']), R::money($r['received']),
            $r['at_source'] > 0 ? R::money($r['at_source']) : '—',
            $r['security_held'] > 0 ? R::money($r['security_held']) : '—',
            '<b>' . R::money($r['gap']) . '</b>',
        ];
    }

    private function clientSection($clients, array $t): array
    {
        return [
            'heading' => '1. By client',
            'columns' => array_merge([
                ['label' => 'Client', 'width' => '35%'],
                ['label' => 'Jobs', 'align' => 'center', 'width' => '6%'],
            ], $this->moneyCols()),
            'rows' => collect($clients)->map(fn ($c) => array_merge([e($c['customer']), (string) $c['jobs']], $this->moneyCells($c)))->all(),
            'total' => array_merge(['Total', (string) $t['jobs']], $this->moneyCells($t)),
            'empty' => 'Nothing delivered, billed or received in this period.',
        ];
    }

    private function jobSection($rows, array $t): array
    {
        $qty = fn ($v) => rtrim(rtrim(number_format((float) $v, 3, '.', ''), '0'), '.');

        return [
            'heading' => '2. By job',
            'columns' => array_merge([
                ['label' => 'Job', 'width' => '13%'],
                ['label' => 'Client', 'width' => '19%'],
                ['label' => 'Delivered', 'align' => 'center', 'width' => '9%'],
            ], $this->moneyCols()),
            'rows' => collect($rows)->map(fn ($r) => array_merge([
                e($r['job']), e($r['customer']), $qty($r['delivered_qty']) . ' of ' . $qty($r['ordered_qty']),
            ], $this->moneyCells($r)))->all(),
            'total' => array_merge(['Total', '', ''], $this->moneyCells($t)),
            'empty' => 'Nothing delivered, billed or received in this period.',
        ];
    }
}
