<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\CostEstimateLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CostEstimateAiController extends Controller
{
    /**
     * GET /api/cost-estimates/rate-suggestions
     * Returns historical rate stats for a material or operation.
     */
    public function rateSuggestions(Request $request): JsonResponse
    {
        $materialId  = $request->input('material_id');
        $operationId = $request->input('operation_id');
        $section     = $request->input('section', 'material');

        $query = CostEstimateLine::query()
            ->whereHas('estimate', fn($q) => $q->whereIn('status', ['finalized', 'used']))
            ->where('rate', '>', 0);

        if ($materialId) {
            $query->where('material_id', $materialId);
        } elseif ($operationId) {
            $query->where('operation_id', $operationId);
        } else {
            // Fuzzy match by description
            $desc = $request->input('description', '');
            if (strlen($desc) < 3) return response()->json(['suggestions' => null]);
            $query->where('description', 'like', "%{$desc}%")->where('section', $section);
        }

        $rates = $query->latest()->limit(20)->pluck('rate')->map(fn($r) => (float) $r);

        if ($rates->isEmpty()) {
            return response()->json(['suggestions' => null]);
        }

        $quantities = $query->limit(20)->pluck('quantity')->map(fn($q) => (float) $q);

        return response()->json([
            'suggestions' => [
                'min_rate'   => round($rates->min(), 2),
                'max_rate'   => round($rates->max(), 2),
                'avg_rate'   => round($rates->avg(), 2),
                'median_rate'=> round($rates->sort()->values()->get((int) floor($rates->count() / 2)) ?? $rates->avg(), 2),
                'avg_qty'    => round($quantities->avg(), 2),
                'sample_count'=> $rates->count(),
                'last_rate'  => round($rates->first(), 2),
            ],
        ]);
    }

    /**
     * GET /api/cost-estimates/find-similar
     * Finds the most similar historical estimate based on job_name, customer, or product keywords.
     */
    public function findSimilar(Request $request): JsonResponse
    {
        $jobName    = $request->input('job_name', '');
        $customerId = $request->input('customer_id');

        if (strlen($jobName) < 3 && !$customerId) {
            return response()->json(['match' => null]);
        }

        $query = CostEstimate::with('lines')
            ->whereIn('status', ['finalized', 'used'])
            ->where('grand_total', '>', 0);

        // Strategy 1: Same customer + similar job name (best match)
        $best = null;
        if ($customerId && $jobName) {
            $best = (clone $query)
                ->where('customer_id', $customerId)
                ->where('job_name', 'like', "%{$jobName}%")
                ->latest()->first();
        }

        // Strategy 2: Similar job name from any customer
        if (!$best && $jobName) {
            $best = (clone $query)->where('job_name', 'like', "%{$jobName}%")->latest()->first();
        }

        // Strategy 3: keyword match
        if (!$best && $jobName) {
            $keywords = array_filter(explode(' ', $jobName), fn($w) => strlen($w) > 3);
            foreach ($keywords as $kw) {
                $best = (clone $query)->where('job_name', 'like', "%{$kw}%")->latest()->first();
                if ($best) break;
            }
        }

        // Strategy 4: Same customer, any job
        if (!$best && $customerId) {
            $best = (clone $query)->where('customer_id', $customerId)->latest()->first();
        }

        if (!$best) {
            return response()->json(['match' => null]);
        }

        return response()->json([
            'match' => [
                'id'              => $best->id,
                'estimate_no'     => $best->estimate_no,
                'job_name'        => $best->job_name,
                'company_name'    => $best->company_name,
                'pricing_group'   => $best->pricing_group,
                'overhead_pct'    => $best->overhead_pct,
                'vat_pct'         => $best->vat_pct,
                'times_multiplier'=> $best->times_multiplier,
                'job_quantity'    => $best->job_quantity,
                'grand_total'     => $best->grand_total,
                'part_no'         => $best->part_no,
                'actual_size'     => $best->actual_size,
                'materials_size'  => $best->materials_size,
                'lines'           => $best->lines->map(fn($l) => [
                    'section'      => $l->section,
                    'material_id'  => $l->material_id,
                    'operation_id' => $l->operation_id,
                    'description'  => $l->description,
                    'quantity'     => (string) $l->quantity,
                    'unit'         => $l->unit,
                    'rate'         => (string) $l->rate,
                ]),
            ],
        ]);
    }
}
