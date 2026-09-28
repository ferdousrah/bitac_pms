<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Make the approval configuration centre-aware.
 *
 * `quotation_approval_settings` and `gate_pass_approvers` carried no
 * `center_id` and nothing filtered by centre — so ONE global chain served
 * quotations AND cost estimates (CostEstimateController::buildApprovalChain
 * reads QuotationApprovalSetting directly) across all six BITAC centres.
 *
 * Nothing was broken because only Dhaka is live and the chain holds a single
 * row. The day a second centre goes up, Dhaka's approvers would be approving
 * Chittagong's quotations, and one centre's admin editing the chain would
 * change it for everyone. Migrating now is one UPDATE; migrating later, with
 * six centres of live approval history, is not.
 *
 * Decision from BITAC: chains are SEPARATE PER CENTRE — no shared
 * head-office steps.
 *
 * ⚠️ Every step checks its own state first. MySQL does not roll DDL back, so a
 * migration that dies halfway leaves the table half-changed and un-recorded;
 * this one can simply be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Existing rows belong to the only centre that has ever been live.
        $fallback = DB::table('centers')->orderBy('id')->value('id') ?? 1;

        foreach (['quotation_approval_settings', 'gate_pass_approvers'] as $table) {
            if (!Schema::hasColumn($table, 'center_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->foreignId('center_id')->nullable()->after('id')->constrained()->nullOnDelete();
                });
            }
            DB::table($table)->whereNull('center_id')->update(['center_id' => $fallback]);
        }

        // The uniques were GLOBAL, which per-centre chains cannot live with:
        //   level unique    → Dhaka's level 1 would block Chittagong's level 1
        //   user_id unique  → one officer could not approve at two centres
        if (!$this->hasIndex('quotation_approval_settings', 'quotation_approval_settings_center_id_level_unique')) {
            Schema::table('quotation_approval_settings', function (Blueprint $t) {
                $t->unique(['center_id', 'level']);
            });
        }
        $this->dropIndexIfExists('quotation_approval_settings', 'quotation_approval_settings_level_unique');

        // ⚠️ Add BEFORE dropping, and keep `user_id` LEFTMOST. MySQL refuses to
        // drop the last index backing a foreign key, and
        // gate_pass_approvers_user_id_foreign has nothing else to sit on — the
        // first attempt at this migration died exactly there.
        if (!$this->hasIndex('gate_pass_approvers', 'gate_pass_approvers_user_id_center_id_unique')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->unique(['user_id', 'center_id']);
            });
        }
        $this->dropIndexIfExists('gate_pass_approvers', 'gate_pass_approvers_user_id_unique');
    }

    public function down(): void
    {
        Schema::table('quotation_approval_settings', function (Blueprint $t) {
            $t->unique('level');
        });
        $this->dropIndexIfExists('quotation_approval_settings', 'quotation_approval_settings_center_id_level_unique');

        Schema::table('gate_pass_approvers', function (Blueprint $t) {
            $t->unique('user_id');
        });
        $this->dropIndexIfExists('gate_pass_approvers', 'gate_pass_approvers_user_id_center_id_unique');

        foreach (['quotation_approval_settings', 'gate_pass_approvers'] as $table) {
            if (Schema::hasColumn($table, 'center_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropConstrainedForeignId('center_id');
                });
            }
        }
    }

    private function hasIndex(string $table, string $index): bool
    {
        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        if ($this->hasIndex($table, $index)) {
            Schema::table($table, fn (Blueprint $t) => $t->dropUnique($index));
        }
    }
};
