<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Free the cost estimates that are marked "used" but have no quotation.
 *
 * `useAsQuotation()` used to set `status = 'used'` the moment someone clicked
 * the button, before any quotation existed — it only opened the quotation
 * form. Anyone who opened that form and then closed the tab left the estimate
 * stranded: its history says "Used as Quotation", there is no quotation to
 * show for it, and the Show page hides the button on that exact status, so
 * there was no way back. Nothing ever wrote `cost_estimates.quotation_id`
 * either, so the two cases were indistinguishable.
 *
 * For each stranded row:
 *   - a quotation DOES exist on the same RFQ → link it and keep it used;
 *   - otherwise → put the status back to whatever it was before the click,
 *     read from the revision snapshot taken just before that event.
 */
return new class extends Migration
{
    public function up(): void
    {
        $stuck = DB::table('cost_estimates')
            ->where('status', 'used')
            ->whereNull('quotation_id')
            ->get(['id', 'rfq_id', 'approval_status']);

        foreach ($stuck as $e) {
            // Did a quotation actually come out of it? Oldest first, so an
            // estimate is attributed to the quotation it most plausibly fed.
            $quotationId = $e->rfq_id
                ? DB::table('quotations')
                    ->where('rfq_id', $e->rfq_id)
                    ->whereNotIn('id', function ($q) {
                        // Don't hand the same quotation to two estimates.
                        $q->select('quotation_id')->from('cost_estimates')->whereNotNull('quotation_id');
                    })
                    ->orderBy('id')
                    ->value('id')
                : null;

            if ($quotationId) {
                DB::table('cost_estimates')->where('id', $e->id)->update(['quotation_id' => $quotationId]);
                continue;
            }

            DB::table('cost_estimates')->where('id', $e->id)->update([
                'status' => $this->statusBeforeUse($e->id, $e->approval_status),
            ]);
        }
    }

    /**
     * The status this estimate had before it was marked used.
     *
     * The revision immediately preceding the `used_as_quotation` event holds a
     * snapshot of the row as it was, so this restores exactly what was there
     * rather than guessing — which matters because `status` decides whether an
     * estimate counts as the effective one for its part, and that feeds the
     * job total a quotation is priced from.
     */
    private function statusBeforeUse(int $estimateId, ?string $approvalStatus): string
    {
        $usedRevisionNo = DB::table('entity_revisions')
            ->where('entity_type', 'cost_estimate')
            ->where('entity_id', $estimateId)
            ->where('event', 'used_as_quotation')
            ->orderBy('revision_no')
            ->value('revision_no');

        if ($usedRevisionNo) {
            $snapshot = DB::table('entity_revisions')
                ->where('entity_type', 'cost_estimate')
                ->where('entity_id', $estimateId)
                ->where('revision_no', '<', $usedRevisionNo)
                ->orderByDesc('revision_no')
                ->value('snapshot');

            $prior = is_string($snapshot) ? json_decode($snapshot, true) : $snapshot;
            $status = $prior['status'] ?? null;

            if (is_string($status) && $status !== '' && $status !== 'used') {
                return $status;
            }
        }

        // No usable history — fall back to what the approval says.
        return $approvalStatus === 'approved' ? 'finalized' : 'draft';
    }

    public function down(): void
    {
        // Nothing to undo: this repairs data that should never have been
        // written. Re-marking those estimates "used" would recreate the bug.
    }
};
