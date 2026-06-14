<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The PCD officer who composed the Work Order form (items + routing) — distinct
 * from `created_by` (original WO author, often customer or staff) and
 * `pcd_handoff_by` (the IED person who forwarded it). Drives the "Prepared By"
 * signature block on the printed Work Order.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('work_orders', 'prepared_by')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->foreignId('prepared_by')->nullable()->after('created_by')
                    ->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_orders', 'prepared_by')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropForeign(['prepared_by']);
                $table->dropColumn('prepared_by');
            });
        }
    }
};
