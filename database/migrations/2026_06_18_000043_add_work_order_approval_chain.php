<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Put work-order acceptance behind an approval chain.
 *
 * Accepting a work order was guarded only by `permission:view rfqs`, and
 * nothing stopped the creator accepting their own — so whoever issued the WO
 * from the approved quotation could immediately wave it through to PCD.
 *
 * Two pieces:
 *
 * 1. `quotation_approval_settings.document_type` — that table already drives
 *    BOTH quotations and cost estimates (its name is historical), so work
 *    orders get their own rows in it rather than a parallel table. Existing
 *    rows become `quotation`, which is what quotations and estimates read.
 *    Work orders read `work_order` and are therefore a SEPARATE chain: the
 *    quotation already passed its approvers, and repeating them on the work
 *    order is the same signature twice.
 *
 * 2. `work_order_approvals` — the per-WO rows, mirroring
 *    `quotation_approvals`: level, status, remarks, signature, acted_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('quotation_approval_settings', 'document_type')) {
            Schema::table('quotation_approval_settings', function (Blueprint $t) {
                $t->string('document_type', 20)->default('quotation')->after('center_id');
            });
        }
        DB::table('quotation_approval_settings')->whereNull('document_type')
            ->orWhere('document_type', '')->update(['document_type' => 'quotation']);

        // ⚠️ The unique was (center_id, level); with a second document type in
        // the same table it has to include the type, or a work-order level 1
        // would collide with a quotation level 1 at the same centre.
        //
        // Add BEFORE dropping, and keep `center_id` LEFTMOST — the old index
        // is what backs quotation_approval_settings_center_id_foreign, and
        // MySQL refuses to drop the last index a foreign key sits on. That is
        // exactly what killed the first run of this migration.
        if (! $this->hasIndex('quotation_approval_settings', 'qas_center_doc_level_unique')) {
            Schema::table('quotation_approval_settings', function (Blueprint $t) {
                $t->unique(['center_id', 'document_type', 'level'], 'qas_center_doc_level_unique');
            });
        }
        $this->dropIndexIfExists('quotation_approval_settings', 'quotation_approval_settings_center_id_level_unique');

        if (Schema::hasTable('work_order_approvals')) return;

        Schema::create('work_order_approvals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('approver_id')->constrained('users')->cascadeOnDelete();
            $t->unsignedInteger('level')->default(1);
            $t->string('label', 100)->nullable();
            $t->string('status', 20)->default('pending');   // pending | approved | rejected
            $t->text('remarks')->nullable();
            // Snapshot of the image signed with — a path, never a signature id,
            // so renaming or deleting a saved signature can't alter a decision
            // already taken (see the Signatures section in CLAUDE.md).
            $t->string('signature_path', 255)->nullable();
            $t->timestamp('acted_at')->nullable();
            $t->timestamps();

            $t->index(['work_order_id', 'level']);
            $t->index(['approver_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_approvals');

        Schema::table('quotation_approval_settings', function (Blueprint $t) {
            $t->unique(['center_id', 'level']);
        });
        $this->dropIndexIfExists('quotation_approval_settings', 'qas_center_doc_level_unique');

        Schema::table('quotation_approval_settings', function (Blueprint $t) {
            $t->dropColumn('document_type');
        });
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
