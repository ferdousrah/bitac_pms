<?php

namespace App\Services;

use App\Models\CostEstimate;
use App\Models\CostEstimateLine;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RfqAutomationService
{
    // ─── Duplicate Detection ────────────────────────────────────────

    /**
     * Check if a similar RFQ exists for the same customer within the lookback window.
     */
    public function detectDuplicate(int $customerId, array $items): ?Rfq
    {
        $days = (int) $this->setting('duplicate_detection_days', 90);
        $since = now()->subDays($days);

        $candidates = Rfq::where('customer_id', $customerId)
            ->where('created_at', '>=', $since)
            ->with('items')
            ->get();

        foreach ($candidates as $rfq) {
            $matchScore = $this->calculateItemOverlap($rfq->items->toArray(), $items);
            if ($matchScore >= 70) {
                return $rfq;
            }
        }

        return null;
    }

    private function calculateItemOverlap(array $existingItems, array $newItems): float
    {
        if (empty($existingItems) || empty($newItems)) return 0;

        $matches = 0;
        foreach ($newItems as $newItem) {
            foreach ($existingItems as $existing) {
                // Exact product_id match
                if (!empty($newItem['product_id']) && !empty($existing['product_id'])
                    && $newItem['product_id'] == $existing['product_id']) {
                    $matches++;
                    break;
                }
                // Fuzzy job_description match
                $desc1 = strtolower($newItem['job_description'] ?? '');
                $desc2 = strtolower($existing['job_description'] ?? '');
                if ($desc1 && $desc2 && (str_contains($desc1, $desc2) || str_contains($desc2, $desc1)
                    || similar_text($desc1, $desc2) / max(strlen($desc1), strlen($desc2), 1) > 0.6)) {
                    $matches++;
                    break;
                }
            }
        }

        return ($matches / count($newItems)) * 100;
    }

    // ─── Auto Cost Estimation ───────────────────────────────────────

    /**
     * Generate a draft cost estimate from historical data.
     */
    public function autoEstimate(Rfq $rfq): ?CostEstimate
    {
        if (!$this->setting('auto_estimate_enabled', true)) return null;

        $rfq->load('items', 'customer');
        $minConfidence = (float) $this->setting('min_confidence_score', 40);

        $firstEstimate = null;
        $itemsEstimated = 0;
        $itemsSkipped = 0;

        // Create ONE estimate per RFQ item (new behavior)
        foreach ($rfq->items as $item) {
            // Skip if this item already has an estimate
            if ($item->costEstimates()->exists()) continue;

            $candidates = $this->findHistoricalEstimates($item, $rfq->customer_id);

            $bestMatch = null;
            $bestScore = 0;
            foreach ($candidates as [$estimate, $score]) {
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $estimate;
                }
            }

            if ($bestScore < $minConfidence || !$bestMatch) {
                $itemsSkipped++;
                continue;
            }

            $newEstimate = DB::transaction(function () use ($rfq, $item, $bestMatch, $bestScore) {
                $estimate = CostEstimate::create([
                    'estimate_no'       => CostEstimate::generateEstimateNo(),
                    'rfq_id'            => $rfq->id,
                    'rfq_item_id'       => $item->id,
                    'customer_id'       => $rfq->customer_id,
                    'company_name'      => $rfq->customer->name ?? '',
                    'job_name'          => $item->job_description ?: ($item->product?->name ?? 'Item #' . $item->id),
                    'part_no'           => $bestMatch->part_no,
                    'actual_size'       => $bestMatch->actual_size,
                    'materials_size'    => $bestMatch->materials_size,
                    'pricing_group'     => $bestMatch->pricing_group,
                    'overhead_pct'      => $bestMatch->overhead_pct,
                    'vat_pct'           => $bestMatch->vat_pct,
                    'times_multiplier'  => $bestMatch->times_multiplier,
                    'job_quantity'      => (int) $item->quantity ?: 1,
                    'status'            => 'draft',
                    'notes'             => "Auto-estimated from {$bestMatch->estimate_no} (confidence: {$bestScore}%)",
                    'created_by'        => auth()->id() ?? $rfq->created_by,
                    'automation_source' => 'auto_estimated',
                    'confidence_score'  => $bestScore,
                    'source_estimate_id'=> $bestMatch->id,
                ]);

                foreach ($bestMatch->lines as $line) {
                    CostEstimateLine::create([
                        'cost_estimate_id' => $estimate->id,
                        'section'          => $line->section,
                        'material_id'      => $line->material_id,
                        'operation_id'     => $line->operation_id,
                        'description'      => $line->description,
                        'quantity'         => $line->quantity,
                        'unit'             => $line->unit,
                        'rate'             => $line->rate,
                        'amount'           => $line->amount,
                        'sequence'         => $line->sequence,
                    ]);
                }

                $estimate->recalculate();
                return $estimate;
            });

            $firstEstimate = $firstEstimate ?? $newEstimate;
            $itemsEstimated++;

            $this->log($rfq->id, 'estimate_generated', 'system', [
                'estimate_id'     => $newEstimate->id,
                'estimate_no'     => $newEstimate->estimate_no,
                'rfq_item_id'     => $item->id,
                'source_id'       => $bestMatch->id,
                'confidence_score'=> $bestScore,
                'grand_total'     => $newEstimate->grand_total,
            ]);
        }

        if ($itemsEstimated === 0) {
            $this->log($rfq->id, 'auto_estimate_skipped', 'system', [
                'reason'         => "No historical match above minimum confidence for any of {$rfq->items->count()} items",
                'items_skipped'  => $itemsSkipped,
            ]);
        } else {
            $this->log($rfq->id, 'auto_estimate_batch', 'system', [
                'items_estimated' => $itemsEstimated,
                'items_skipped'   => $itemsSkipped,
            ]);
        }

        return $firstEstimate;
    }

    private function findHistoricalEstimates(RfqItem $item, int $customerId): array
    {
        $results = [];

        $query = CostEstimate::with('lines')
            ->whereNotNull('grand_total')
            ->where('grand_total', '>', 0)
            ->latest();

        // Strategy 1: Same product_id from same customer (95%)
        if ($item->product_id) {
            $match = (clone $query)->where('customer_id', $customerId)
                ->where('job_name', 'like', '%' . ($item->product?->name ?? '') . '%')
                ->first();
            if ($match) $results[] = [$match, 95];

            // Strategy 2: Same product from any customer (80%)
            $match2 = (clone $query)->where('job_name', 'like', '%' . ($item->product?->name ?? '') . '%')
                ->first();
            if ($match2 && (!$match || $match2->id !== $match->id)) {
                $results[] = [$match2, 80];
            }
        }

        // Strategy 3: Similar job description from same customer (60%)
        if ($item->job_description) {
            $keywords = array_filter(explode(' ', $item->job_description), fn($w) => strlen($w) > 3);
            foreach ($keywords as $kw) {
                $match3 = (clone $query)->where('customer_id', $customerId)
                    ->where('job_name', 'like', "%{$kw}%")
                    ->first();
                if ($match3) {
                    $results[] = [$match3, 60];
                    break;
                }
            }

            // Strategy 4: Similar description from any customer (40%)
            foreach ($keywords as $kw) {
                $match4 = (clone $query)->where('job_name', 'like', "%{$kw}%")
                    ->first();
                if ($match4) {
                    $results[] = [$match4, 40];
                    break;
                }
            }
        }

        return $results;
    }

    // ─── Smart Quotation Generation ─────────────────────────────────

    /**
     * Auto-generate a draft quotation from a finalized cost estimate.
     */
    public function autoGenerateQuotation(CostEstimate $estimate, array $overrides = []): ?Quotation
    {
        $rfqId       = $estimate->rfq_id;
        $customerId  = $estimate->customer_id;
        $margin      = $overrides['profit_margin'] ?? (float) $this->setting('default_profit_margin', 15);
        $validityDays= (int) $this->setting('default_validity_days', 30);
        $vatRate     = (float) $this->setting('default_vat_rate', 15);

        $materialCost = (float) $estimate->material_cost;
        $labourCost   = (float) $estimate->machining_cost + (float) $estimate->surface_cost;
        $overheadCost = (float) $estimate->overhead_amount + (float) $estimate->other_cost;
        $subtotal     = $materialCost + $labourCost + $overheadCost;
        $profitAmount = $subtotal * ($margin / 100);
        $beforeVat    = $subtotal + $profitAmount;
        $vatAmount    = $beforeVat * ($vatRate / 100);
        $totalAmount  = $beforeVat + $vatAmount;

        $quotation = Quotation::create([
            'rfq_id'              => $rfqId,
            'customer_id'         => $customerId,
            'work_order_id'       => null,
            'created_by'          => auth()->id() ?? $estimate->created_by,
            'version'             => 1,
            'material_cost'       => round($materialCost, 2),
            'labour_cost'         => round($labourCost, 2),
            'overhead_cost'       => round($overheadCost, 2),
            'profit_margin'       => $margin,
            'discount'            => 0,
            'vat_rate'            => $vatRate,
            'vat_amount'          => round($vatAmount, 2),
            'total_amount'        => round($totalAmount, 2),
            'validity_days'       => $validityDays,
            'status'              => 'draft',
            'notes'               => "Auto-generated from estimate {$estimate->estimate_no}",
            'automation_source'   => 'auto_generated',
            'validity_expires_at' => now()->addDays($validityDays),
        ]);

        // Update RFQ status
        if ($rfqId) {
            Rfq::where('id', $rfqId)->update(['status' => 'quoted']);
        }

        $this->log($rfqId, 'quotation_generated', 'system', [
            'quotation_id'  => $quotation->id,
            'total_amount'  => $totalAmount,
            'profit_margin' => $margin,
            'source_estimate' => $estimate->estimate_no,
        ]);

        return $quotation;
    }

    // ─── Threshold-Based Approval Routing ────────────────────────────

    public function routeApproval(Quotation $quotation): array
    {
        $threshold = (float) $this->setting('auto_approve_threshold', 50000);

        if ((float) $quotation->total_amount < $threshold) {
            $quotation->update([
                'auto_approval_eligible' => true,
                'status' => 'approved',
            ]);
            $this->log($quotation->rfq_id, 'auto_approved', 'system', [
                'quotation_id' => $quotation->id,
                'total_amount' => $quotation->total_amount,
                'threshold'    => $threshold,
            ]);
            return ['action' => 'auto_approved', 'threshold' => $threshold];
        }

        return ['action' => 'manual_approval_required', 'total' => $quotation->total_amount];
    }

    // ─── Customer Follow-up ─────────────────────────────────────────

    public function checkFollowups(): array
    {
        if (!$this->setting('followup_enabled', true)) {
            return ['checked' => 0, 'notified' => 0];
        }

        $quotations = Quotation::where('status', 'approved')
            ->whereNotNull('validity_expires_at')
            ->where('followup_count', '<', 3)
            ->where(function ($q) {
                $q->where('validity_expires_at', '<=', now()->addDays(7));
            })
            ->with('customer', 'createdBy')
            ->get();

        $notified = 0;
        foreach ($quotations as $q) {
            $daysLeft = now()->diffInDays($q->validity_expires_at, false);
            $urgency  = $daysLeft <= 0 ? 'expired' : ($daysLeft <= 3 ? 'urgent' : 'reminder');

            $message = match ($urgency) {
                'expired' => "Quotation #{$q->id} for {$q->customer->name} has EXPIRED (৳" . number_format($q->total_amount) . ")",
                'urgent'  => "Quotation #{$q->id} for {$q->customer->name} expires in {$daysLeft} days (৳" . number_format($q->total_amount) . ")",
                default   => "Quotation #{$q->id} for {$q->customer->name} expires in {$daysLeft} days — follow up recommended",
            };

            // Notify the quotation creator
            if ($q->created_by) {
                Notification::create([
                    'user_id' => $q->created_by,
                    'type'    => 'quotation_followup',
                    'icon'    => 'fi-rr-clock',
                    'color'   => $urgency === 'expired' ? 'red' : ($urgency === 'urgent' ? 'amber' : 'blue'),
                    'title'   => $urgency === 'expired' ? 'Quotation Expired' : 'Quotation Follow-up',
                    'body'    => $message,
                    'link'    => "/quotations/{$q->id}",
                ]);
            }

            $q->update([
                'followup_count'  => $q->followup_count + 1,
                'last_followup_at'=> now(),
            ]);

            $notified++;
        }

        return ['checked' => $quotations->count(), 'notified' => $notified];
    }

    // ─── Analytics ──────────────────────────────────────────────────

    public function getConversionRate(string $period = 'this_month'): array
    {
        $from = $this->periodStart($period);
        $total   = Rfq::where('created_at', '>=', $from)->count();
        $quoted  = Rfq::where('created_at', '>=', $from)->where('status', 'quoted')->count();
        $converted = Quotation::where('created_at', '>=', $from)->where('status', 'converted')->count();

        return [
            'period'          => $period,
            'total_rfqs'      => $total,
            'quoted'          => $quoted,
            'converted_to_wo' => $converted,
            'rfq_to_quote_pct'=> $total > 0 ? round(($quoted / $total) * 100, 1) : 0,
            'quote_to_wo_pct' => $quoted > 0 ? round(($converted / $quoted) * 100, 1) : 0,
            'overall_pct'     => $total > 0 ? round(($converted / $total) * 100, 1) : 0,
        ];
    }

    public function getAvgTimeToQuotation(string $period = 'this_month'): array
    {
        $from = $this->periodStart($period);

        $rfqs = Rfq::where('created_at', '>=', $from)
            ->where('status', 'quoted')
            ->with('latestQuotation')
            ->get();

        $times = $rfqs->map(function ($rfq) {
            $q = $rfq->latestQuotation;
            return $q ? $rfq->created_at->diffInHours($q->created_at) : null;
        })->filter();

        return [
            'period'    => $period,
            'avg_hours' => $times->count() > 0 ? round($times->avg(), 1) : null,
            'min_hours' => $times->count() > 0 ? round($times->min(), 1) : null,
            'max_hours' => $times->count() > 0 ? round($times->max(), 1) : null,
            'sample'    => $times->count(),
        ];
    }

    public function getRfqStatusBreakdown(): array
    {
        return Rfq::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }

    public function getTopCustomersByRfq(int $limit = 10): array
    {
        return Rfq::with('customer')
            ->selectRaw('customer_id, COUNT(*) as rfq_count')
            ->groupBy('customer_id')
            ->orderByDesc('rfq_count')
            ->limit($limit)
            ->get()
            ->map(fn($r) => [
                'customer' => $r->customer->name ?? '—',
                'rfq_count'=> $r->rfq_count,
            ])
            ->toArray();
    }

    public function getPipelineSummary(): array
    {
        return [
            'rfqs_pending'          => Rfq::where('status', 'pending')->count(),
            'rfqs_quoted'           => Rfq::where('status', 'quoted')->count(),
            'quotations_draft'      => Quotation::where('status', 'draft')->count(),
            'quotations_pending'    => Quotation::where('status', 'pending_approval')->count(),
            'quotations_approved'   => Quotation::where('status', 'approved')->count(),
            'quotations_expiring'   => Quotation::where('status', 'approved')
                                        ->whereNotNull('validity_expires_at')
                                        ->where('validity_expires_at', '<=', now()->addDays(7))
                                        ->count(),
            'auto_estimates_pending'=> CostEstimate::where('automation_source', 'auto_estimated')
                                        ->where('status', 'draft')->count(),
        ];
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private function setting(string $key, mixed $default = null): mixed
    {
        return app(SettingService::class)->get("rfq_auto.{$key}", $default);
    }

    private function periodStart(string $period): Carbon
    {
        return match ($period) {
            'today'        => Carbon::today(),
            'this_week'    => Carbon::now()->startOfWeek(),
            'this_quarter' => Carbon::now()->firstOfQuarter(),
            'this_year'    => Carbon::now()->startOfYear(),
            default        => Carbon::now()->startOfMonth(),
        };
    }

    private function log(?int $rfqId, string $action, string $actor, array $details = []): void
    {
        DB::table('rfq_automation_logs')->insert([
            'rfq_id'     => $rfqId,
            'action'     => $action,
            'actor'      => $actor,
            'details'    => json_encode($details),
            'created_at' => now(),
        ]);
    }
}
