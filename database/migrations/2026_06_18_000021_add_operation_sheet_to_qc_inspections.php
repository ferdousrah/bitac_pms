<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * QC inspections move from WO-wide to per-OperationSheet (which is itself per
 * WO item). Each item gets its own inspection stream — independent incoming /
 * in-process / final results, its own checklist, its own Inspection Certificate.
 *
 * Legacy rows (work_order_item_id chain didn't exist yet) keep operation_sheet_id
 * NULL — they continue to act as WO-wide inspections, no rewrite needed.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('qc_inspections', 'operation_sheet_id')) {
            Schema::table('qc_inspections', function (Blueprint $table) {
                $table->foreignId('operation_sheet_id')->nullable()->after('work_order_id')
                    ->constrained('operation_sheets')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('qc_inspections', 'operation_sheet_id')) {
            Schema::table('qc_inspections', function (Blueprint $table) {
                $table->dropForeign(['operation_sheet_id']);
                $table->dropColumn('operation_sheet_id');
            });
        }
    }
};
