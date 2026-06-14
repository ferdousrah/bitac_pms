<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Operation sheets are now item-wise: each work_order_item gets its own sheet
 * with its own routing, steps, QR code, and approval. Legacy sheets that pre-date
 * this change carry NULL and act as WO-wide sheets (kept for back-compat reads).
 *
 * The composite unique index enforces one sheet per item per WO without breaking
 * existing rows (NULL values are not compared by MySQL's unique constraint).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('operation_sheets', function (Blueprint $table) {
            if (!Schema::hasColumn('operation_sheets', 'work_order_item_id')) {
                $table->foreignId('work_order_item_id')->nullable()->after('work_order_id')
                    ->constrained('work_order_items')->nullOnDelete();
            }
        });

        // Composite unique on (work_order_id, work_order_item_id). MySQL's
        // semantics for NULL make legacy NULL-item rows non-conflicting.
        Schema::table('operation_sheets', function (Blueprint $table) {
            $table->unique(['work_order_id', 'work_order_item_id'], 'op_sheet_wo_item_unique');
        });
    }

    public function down(): void
    {
        Schema::table('operation_sheets', function (Blueprint $table) {
            $table->dropUnique('op_sheet_wo_item_unique');
        });
        Schema::table('operation_sheets', function (Blueprint $table) {
            if (Schema::hasColumn('operation_sheets', 'work_order_item_id')) {
                $table->dropForeign(['work_order_item_id']);
                $table->dropColumn('work_order_item_id');
            }
        });
    }
};
