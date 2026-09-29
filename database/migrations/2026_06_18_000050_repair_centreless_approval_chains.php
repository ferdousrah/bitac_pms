<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Repair approval chains that were keyed to no centre at all.
 *
 * `HasCenter` used to leave `center_id` NULL whenever no centre was active —
 * which is exactly the state a **super admin who has not picked a centre** is
 * in. Rows written then belonged to nowhere.
 *
 * For the approval configuration that was quietly fatal:
 *   • the admin screen listed the chain (its query does not filter when no
 *     centre is active), so it looked correctly set up;
 *   • `forCenter($doc->center_id)` matched none of it, so every quotation and
 *     cost estimate fell through to the **management-role fallback** and went
 *     to the Director General instead of the configured approvers.
 *
 * Reported from the live system: the chain read "Md Rakib Hassan → Mir Md.
 * Anisuzzaman" while Quotation #18 sat pending with the Director General.
 *
 * So: give the orphaned configuration the default centre, and rebuild the
 * chains of documents that have **not been decided yet** — an approval anyone
 * has already given is history and is left exactly as it stands.
 */
return new class extends Migration
{
    public function up(): void
    {
        $default = DB::table('centers')->orderBy('id')->value('id');
        if (! $default) {
            return;
        }

        foreach (['quotation_approval_settings', 'gate_pass_approvers'] as $table) {
            DB::table($table)->whereNull('center_id')->update(['center_id' => $default]);
        }

        $this->rebuildUndecidedQuotationChains($default);
    }

    /**
     * Quotations still waiting on their FIRST decision get the right chain.
     *
     * ⚠️ Deliberately narrow. A quotation is only touched when every one of its
     * approval rows is still `pending` — nobody has approved, rejected or asked
     * for changes. Rebuilding a chain somebody has already signed would erase a
     * decision that was really made.
     */
    private function rebuildUndecidedQuotationChains(int $default): void
    {
        $chain = DB::table('quotation_approval_settings')
            ->where('center_id', $default)
            ->where('document_type', 'quotation')
            ->orderBy('level')
            ->get();

        if ($chain->isEmpty()) {
            return;
        }

        $configured = $chain->pluck('approver_id')->sort()->values()->all();

        // The default centre's, plus any left with no centre at all.
        $quotations = DB::table('quotations')
            ->where('status', 'pending_approval')
            ->where(fn ($q) => $q->where('center_id', $default)->orWhereNull('center_id'))
            ->pluck('id');

        foreach ($quotations as $quotationId) {
            $rows = DB::table('quotation_approvals')->where('quotation_id', $quotationId)->get();

            if ($rows->isEmpty() || $rows->contains(fn ($r) => $r->status !== 'pending')) {
                continue;   // untouched, or already decided — leave it alone
            }

            // Already the configured chain? Nothing to do.
            if ($rows->pluck('approver_id')->sort()->values()->all() === $configured) {
                continue;
            }

            DB::table('quotation_approvals')->where('quotation_id', $quotationId)->delete();

            foreach ($chain as $setting) {
                DB::table('quotation_approvals')->insert([
                    'quotation_id' => $quotationId,
                    'approver_id'  => $setting->approver_id,
                    'level'        => $setting->level,
                    'status'       => 'pending',
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // A centre cannot be un-assigned without losing which rows were
        // orphaned, and a rebuilt chain has no earlier version worth restoring.
    }
};
