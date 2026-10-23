<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BITAC (2026-10-23): a step at the shop, per job — has the material arrived
 * here or not. Recorded on the job's leg at that shop (`work_order_sections`):
 * `material_status` is NULL (not confirmed yet), `received` or `not_received`,
 * with a note (required when not received), who and when.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('work_order_sections', 'material_status')) return;

        Schema::table('work_order_sections', function (Blueprint $t) {
            $t->string('material_status', 20)->nullable();
            $t->text('material_note')->nullable();
            $t->foreignId('material_marked_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('material_marked_at')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('work_order_sections', 'material_status')) return;

        Schema::table('work_order_sections', function (Blueprint $t) {
            $t->dropConstrainedForeignId('material_marked_by');
            $t->dropColumn(['material_status', 'material_note', 'material_marked_at']);
        });
    }
};
