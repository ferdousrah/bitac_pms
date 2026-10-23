<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BITAC (2026-10-23): "job sarao jate requisition dite pare" — material is also
 * needed for no job at all: consumables, tools, a shop's own upkeep.
 *
 *   - a demand's job becomes optional (the shop is still required);
 *   - a requisition's job becomes optional, and it gains `section_id` — the
 *     shop it is for — so a requisition with no job still says whose it is.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE material_demands MODIFY work_order_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE material_requisitions MODIFY work_order_id BIGINT UNSIGNED NULL');

        if (! Schema::hasColumn('material_requisitions', 'section_id')) {
            Schema::table('material_requisitions', function (Blueprint $t) {
                $t->foreignId('section_id')->nullable()->after('work_order_id')->constrained('sections')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('material_requisitions', 'section_id')) {
            Schema::table('material_requisitions', function (Blueprint $t) {
                $t->dropConstrainedForeignId('section_id');
            });
        }
        // Rows with no job cannot survive a NOT NULL job column — they go.
        DB::table('material_requisitions')->whereNull('work_order_id')->delete();
        DB::table('material_demands')->whereNull('work_order_id')->delete();
        DB::statement('ALTER TABLE material_requisitions MODIFY work_order_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE material_demands MODIFY work_order_id BIGINT UNSIGNED NOT NULL');
    }
};
