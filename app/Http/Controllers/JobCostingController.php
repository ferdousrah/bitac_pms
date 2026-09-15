<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\RfqItem;
use App\Models\RfqItemPart;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Job Costing — one consolidated view of a job's cost.
 *
 * A job is costed part by part, which leaves its cost scattered across several
 * estimate documents. This brings them back together: every part, its own
 * estimate and the cost breakdown behind it, rolled up into the single job
 * total that the quotation uses. It is a read-only view over the estimates —
 * nothing is stored here, so it can never disagree with them.
 *
 * Money note: an estimate's section costs (material, machining…) are PER UNIT,
 * and its grand total is that unit cost × times multiplier × its quantity, or a
 * manual override. So breakdown figures are extended by times × quantity before
 * they're summed, and any override shows up as a rounding adjustment rather
 * than silently making the columns fail to add up.
 */
class JobCostingController extends Controller
{
    public function show(RfqItem $rfqItem)
    {
        return Inertia::render('CostEstimate/JobCosting', [
            'job' => $this->summary($rfqItem),
        ]);
    }

    public function pdf(Request $request, RfqItem $rfqItem)
    {
        $job = $this->summary($rfqItem);
        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn ($v) => number_format((float) ($v ?? 0), 2);

        $cell  = 'border: 0.6pt solid #000; padding: 3pt 4pt; font-size: 8.5pt;';
        $head  = $cell . ' background: #f3f4f6; font-weight: bold; text-align: center;';
        $num   = $cell . ' text-align: right;';

        $rows = '';
        foreach ($job['rows'] as $r) {
            if (! $r['estimate']) {
                $rows .= '<tr>'
                    . '<td style="' . $cell . ' text-align:center;">' . $esc($r['part_no']) . '</td>'
                    . '<td style="' . $cell . '">' . $esc($r['name']) . '</td>'
                    . '<td style="' . $num . '">' . $fmt($r['quantity']) . ' ' . $esc($r['unit']) . '</td>'
                    . '<td colspan="9" style="' . $cell . ' text-align:center; color:#b45309;">Not cost-estimated yet</td>'
                    . '</tr>';
                continue;
            }
            $b = $r['breakdown'];
            $rows .= '<tr>'
                . '<td style="' . $cell . ' text-align:center;">' . $esc($r['part_no']) . '</td>'
                . '<td style="' . $cell . '">' . $esc($r['name']) . '<br><span style="font-size:7pt; color:#555;">' . $esc($r['estimate']['estimate_no']) . '</span></td>'
                . '<td style="' . $num . '">' . $fmt($r['quantity']) . ' ' . $esc($r['unit']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['material']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['machining']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['surface']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['other']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['overhead'] + $b['extra']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['vat'] + $b['tax']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($b['adjustment']) . '</td>'
                . '<td style="' . $num . '">' . $fmt($r['unit_cost']) . '</td>'
                . '<td style="' . $num . ' font-weight:bold;">' . $fmt($r['grand_total']) . '</td>'
                . '</tr>';
        }

        $t = $job['totals'];
        $rows .= '<tr style="background:#eef2ff;">'
            . '<td colspan="3" style="' . $cell . ' text-align:right; font-weight:bold;">Job Total</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['material']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['machining']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['surface']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['other']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['overhead'] + $t['extra']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['vat'] + $t['tax']) . '</td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($t['adjustment']) . '</td>'
            . '<td style="' . $cell . '"></td>'
            . '<td style="' . $num . ' font-weight:bold;">' . $fmt($job['job_total']) . '</td>'
            . '</tr>';

        $missing = $job['missing'] > 0
            ? '<p style="font-size:9pt; color:#b45309; margin-top:6pt;"><b>Note:</b> ' . $job['missing']
              . ' of ' . $job['part_count'] . ' part(s) are not cost-estimated yet, so the job total above is incomplete.</p>'
            : '';

        $body = '<div style="text-align:center; font-size:13pt; font-weight:bold; margin-bottom:2pt;">JOB COSTING SUMMARY</div>'
            . '<div style="text-align:center; font-family: siyamrupali; font-size:10pt; margin-bottom:8pt;">জব কস্টিং সারসংক্ষেপ</div>'
            . '<table width="100%" style="font-size:9.5pt; margin-bottom:8pt;">'
            . '<tr><td width="55%"><b>Job:</b> ' . $esc($job['job_description']) . '</td>'
            . '<td align="right"><b>RFQ:</b> #' . $esc($job['rfq_id']) . ' &nbsp; <b>Date:</b> ' . now()->format('d/m/Y') . '</td></tr>'
            . '<tr><td><b>Customer:</b> ' . $esc($job['customer']) . '</td>'
            . '<td align="right"><b>Job Quantity:</b> ' . $fmt($job['job_quantity']) . ' ' . $esc($job['job_unit']) . '</td></tr>'
            . '</table>'
            . '<table width="100%" style="border-collapse: collapse;">'
            . '<tr>'
            . '<td style="' . $head . '">Part</td><td style="' . $head . '">Name / Estimate</td><td style="' . $head . '">Qty</td>'
            . '<td style="' . $head . '">Material</td><td style="' . $head . '">Machining</td><td style="' . $head . '">Surface</td>'
            . '<td style="' . $head . '">Other</td><td style="' . $head . '">Overhead</td><td style="' . $head . '">VAT + Tax</td>'
            . '<td style="' . $head . '">Adjust.</td><td style="' . $head . '">Unit Cost</td><td style="' . $head . '">Total (৳)</td>'
            . '</tr>' . $rows . '</table>'
            . $missing
            . '<table width="100%" style="margin-top:10pt; font-size:10pt;">'
            . '<tr><td align="right"><b>Job Total:</b> ৳' . $fmt($job['job_total']) . '</td></tr>'
            . '<tr><td align="right"><b>Per ' . $esc($job['job_unit']) . ' (Job Total ÷ ' . $fmt($job['job_quantity']) . '):</b> ৳' . $fmt($job['per_job_unit']) . '</td></tr>'
            . '</table>'
            . '<p style="font-size:7.5pt; color:#666; margin-top:10pt;">Consolidated from the individual part cost estimates. Section figures are extended by each estimate\'s quantity and multiplier; "Adjust." is any manual rounding applied to an estimate\'s grand total. Amounts include VAT &amp; Tax.</p>';

        $lang  = $request->query('lang') === 'en' ? 'en' : 'bn';
        $bytes = app(\App\Services\BitacLetterhead::class)->render($body, "Job Costing — RFQ #{$job['rfq_id']}", null, $lang);
        $filename = "job-costing-rfq{$job['rfq_id']}-item{$rfqItem->id}.pdf";

        if ($request->input('preview') === 'base64') {
            return response()->json(['filename' => $filename, 'size' => strlen($bytes), 'data' => base64_encode($bytes)]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment') . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * Everything both the page and the PDF need, derived from the estimates.
     * The job total is taken from RfqItem::jobCostBreakdown() so it is always
     * the same number the quotation uses.
     */
    private function summary(RfqItem $rfqItem): array
    {
        $rfqItem->load(['rfq.customer', 'product', 'parts.costEstimates.lines']);
        $cost  = $rfqItem->jobCostBreakdown();
        $parts = $rfqItem->parts->values();

        $rows = [];
        if ($parts->isNotEmpty()) {
            foreach ($parts as $idx => $part) {
                $rows[] = $this->row(
                    RfqItemPart::formatNo($idx, $parts->count()),
                    $part->name,
                    (float) $part->quantity,
                    $part->unit,
                    $part->effectiveEstimate(),
                    $part->id,
                );
            }
        } elseif ($cost['estimate']) {
            // A job costed as a whole: one row, the job itself.
            $cost['estimate']->load('lines');
            $rows[] = $this->row('—', $rfqItem->job_description ?? 'Whole job', (float) $rfqItem->quantity,
                $rfqItem->unit, $cost['estimate'], null);
        }

        $keys   = ['material', 'machining', 'surface', 'other', 'overhead', 'extra', 'vat', 'tax', 'adjustment'];
        $totals = array_fill_keys($keys, 0.0);
        foreach ($rows as $r) {
            if (! $r['breakdown']) continue;
            foreach ($keys as $k) $totals[$k] += $r['breakdown'][$k];
        }
        $totals = array_map(fn ($v) => round($v, 2), $totals);

        $jobQty    = (float) $rfqItem->quantity;
        $jobTotal  = (float) $cost['total'];
        $submittable = collect($rows)->filter(fn ($r) => $r['estimate'] && $r['estimate']['approval_status'] === 'not_submitted')->count();

        return [
            'rfq_item_id'     => $rfqItem->id,
            'rfq_id'          => $rfqItem->rfq_id,
            'job_description' => $rfqItem->job_description ?? $rfqItem->product?->name ?? "Job #{$rfqItem->id}",
            'customer'        => $rfqItem->rfq?->customer?->name ?? '—',
            'job_quantity'    => $jobQty,
            'job_unit'        => $rfqItem->unit ?? 'pcs',
            'mode'            => $cost['mode'],
            'part_count'      => $cost['part_count'],
            'costed'          => $parts->isNotEmpty() ? $cost['costed'] : (int) ($cost['mode'] === 'item'),
            'missing'         => $parts->isNotEmpty() ? $cost['missing'] : 0,
            'rows'            => $rows,
            'totals'          => $totals,
            'job_total'       => round($jobTotal, 2),
            'per_job_unit'    => $jobQty > 0 ? round($jobTotal / $jobQty, 2) : round($jobTotal, 2),
            'submittable'     => $submittable,
        ];
    }

    private function row(string $partNo, string $name, float $qty, ?string $unit, ?CostEstimate $e, ?int $partId): array
    {
        if (! $e) {
            return [
                'part_id' => $partId, 'part_no' => $partNo, 'name' => $name, 'quantity' => $qty, 'unit' => $unit ?? 'pcs',
                'estimate' => null, 'breakdown' => null, 'unit_cost' => null, 'grand_total' => null, 'lines' => [],
            ];
        }

        // Section costs are per unit; extend them to the estimate's full scope.
        $scale = (float) $e->times_multiplier * (int) $e->job_quantity;
        $ext   = fn ($v) => round((float) $v * $scale, 2);

        $breakdown = [
            'material'  => $ext($e->material_cost),
            'machining' => $ext($e->machining_cost),
            'surface'   => $ext($e->surface_cost),
            'other'     => $ext($e->other_cost),
            'overhead'  => $ext($e->overhead_amount),
            'extra'     => $ext($e->extra_cost),
            'vat'       => $ext($e->vat_amount),
            'tax'       => $ext($e->tax_amount),
        ];
        $auto = round((float) $e->total * (int) $e->job_quantity, 2);
        $breakdown['adjustment'] = round((float) $e->grand_total - $auto, 2);

        $grand = (float) $e->grand_total;

        return [
            'part_id'     => $partId,
            'part_no'     => $partNo,
            'name'        => $name,
            'quantity'    => $qty,
            'unit'        => $unit ?? 'pcs',
            'estimate'    => [
                'id'              => $e->id,
                'estimate_no'     => $e->estimate_no,
                'status'          => $e->status,
                'approval_status' => $e->approval_status ?? 'not_submitted',
                'pricing_group'   => $e->pricing_group,
                'job_quantity'    => (int) $e->job_quantity,
            ],
            'breakdown'   => $breakdown,
            'unit_cost'   => (int) $e->job_quantity > 0 ? round($grand / (int) $e->job_quantity, 2) : round($grand, 2),
            'grand_total' => round($grand, 2),
            'lines'       => $e->lines->map(fn ($l) => [
                'section'     => $l->section,
                'description' => $l->description,
                'quantity'    => (float) $l->quantity,
                'unit'        => $l->unit,
                'rate'        => (float) $l->rate,
                'amount'      => (float) $l->amount,
            ])->values(),
        ];
    }
}
