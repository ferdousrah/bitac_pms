<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Saving the RFQ form used to delete every job and part and create them
 * again, so each cost estimate's rfq_item_id / rfq_item_part_id was SET NULL
 * by the foreign key: the estimates still existed, but the RFQ read ৳0 and
 * the quotation would have been priced from nothing.
 *
 * This puts them back, and only where nothing has to be guessed:
 *  - the JOB comes from the estimate's own revision history (every snapshot
 *    records rfq_item_id): the old job ids, in order, are the jobs in order —
 *    the form recreated them in the same order;
 *  - the PART comes from the estimate's positional part_no ("3/11"), which
 *    must agree with how many parts that job has now.
 * An RFQ whose old ids do not line up one-for-one with its current jobs (it
 * was edited more than once between estimates, or a job was added/removed)
 * is left alone and logged — re-costing a few parts is better than pricing a
 * job from another job's estimate.
 */
return new class extends Migration
{
    public function up(): void
    {
        $orphans = DB::table('cost_estimates')
            ->whereNotNull('rfq_id')
            ->whereNull('rfq_item_id')
            ->get(['id', 'rfq_id', 'part_no', 'estimate_no']);

        foreach ($orphans->groupBy('rfq_id') as $rfqId => $estimates) {
            $items = DB::table('rfq_items')->where('rfq_id', $rfqId)->orderBy('id')->pluck('id')->values();
            if ($items->isEmpty()) continue;

            $oldItem = [];
            foreach ($estimates as $e) {
                $snap = DB::table('entity_revisions')
                    ->where('entity_type', 'cost_estimate')->where('entity_id', $e->id)
                    ->orderByDesc('id')->pluck('snapshot')
                    ->map(fn ($s) => json_decode((string) $s, true)['rfq_item_id'] ?? null)
                    ->first(fn ($v) => $v !== null);
                if ($snap) $oldItem[$e->id] = (int) $snap;
            }

            $oldIds = collect($oldItem)->unique()->sort()->values();
            if ($oldIds->isEmpty()) {
                $this->note("RFQ {$rfqId}: no job recorded in the revision history of " . $estimates->pluck('estimate_no')->implode(', ') . ' — left alone.');
                continue;
            }
            if ($oldIds->count() !== $items->count()) {
                $this->note("RFQ {$rfqId}: estimates name {$oldIds->count()} former jobs, the RFQ has {$items->count()} — left alone: " . $estimates->pluck('estimate_no')->implode(', '));
                continue;
            }
            $map = $oldIds->flip()->map(fn ($pos) => $items[$pos]);

            $fixed = 0;
            foreach ($estimates as $e) {
                if (! isset($oldItem[$e->id])) {
                    $this->note("RFQ {$rfqId}: {$e->estimate_no} has no job in its history — left alone.");
                    continue;
                }
                $itemId = $map[$oldItem[$e->id]];
                $partId = null;

                if (trim((string) $e->part_no) !== '') {
                    $parts = DB::table('rfq_item_parts')->where('rfq_item_id', $itemId)
                        ->orderBy('sort_order')->orderBy('id')->pluck('id')->values();
                    if (! preg_match('#^\s*(\d+)\s*/\s*(\d+)\s*$#', $e->part_no, $m)
                        || (int) $m[2] !== $parts->count() || (int) $m[1] < 1 || (int) $m[1] > $parts->count()) {
                        $this->note("RFQ {$rfqId}: {$e->estimate_no} part no. \"{$e->part_no}\" does not fit the job's {$parts->count()} parts — left alone.");
                        continue;
                    }
                    $partId = $parts[(int) $m[1] - 1];
                }

                DB::table('cost_estimates')->where('id', $e->id)->update([
                    'rfq_item_id'      => $itemId,
                    'rfq_item_part_id' => $partId,
                ]);
                $fixed++;
            }
            if ($fixed) $this->note("RFQ {$rfqId}: re-attached {$fixed} cost estimate(s).");
        }
    }

    public function down(): void
    {
        // Nothing to undo: the links it restores are the ones the estimates had.
    }

    private function note(string $line): void
    {
        Log::info('[reattach estimates] ' . $line);
        if (app()->runningInConsole()) echo "  {$line}\n";
    }
};
