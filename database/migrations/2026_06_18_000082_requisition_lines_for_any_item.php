<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BITAC (2026-10-23): "material sarao je kono item jate requisition dite pare" —
 * a line is not always a metal from the materials master: gloves, oil, bolts,
 * a cutting disc. A line now names EITHER a master material (`material_id`) OR
 * any item, typed (`item_name`). The size/spec stays in `description`.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['material_requisition_items', 'material_demand_items'] as $table) {
            if (! Schema::hasColumn($table, 'item_name')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->string('item_name', 255)->nullable()->after('material_id');
                });
            }
        }
        DB::statement('ALTER TABLE material_demand_items MODIFY material_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        // A typed item has no material to fall back on — those lines go.
        DB::table('material_demand_items')->whereNull('material_id')->delete();
        DB::statement('ALTER TABLE material_demand_items MODIFY material_id BIGINT UNSIGNED NOT NULL');
        foreach (['material_requisition_items', 'material_demand_items'] as $table) {
            if (Schema::hasColumn($table, 'item_name')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('item_name'));
            }
        }
    }
};
