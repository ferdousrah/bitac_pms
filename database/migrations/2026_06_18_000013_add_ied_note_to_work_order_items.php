<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * IED's per-item note for PCD, captured at handoff. Distinct from the
 * existing `notes` column (which carries the customer's own per-item
 * instructions) so PCD can tell at a glance who said what.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('work_order_items', 'ied_note')) {
            Schema::table('work_order_items', function (Blueprint $table) {
                $table->text('ied_note')->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_order_items', 'ied_note')) {
            Schema::table('work_order_items', function (Blueprint $table) {
                $table->dropColumn('ied_note');
            });
        }
    }
};
