<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PCD's per-row remark on the Production Shop Routing table. Distinct from
 * the existing `notes` (which carries the operation/task description) and
 * `qc_notes` (QC step instructions) so the two contexts don't collide.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('work_order_sections', 'remarks')) {
            Schema::table('work_order_sections', function (Blueprint $table) {
                $table->text('remarks')->nullable()->after('qc_notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_order_sections', 'remarks')) {
            Schema::table('work_order_sections', function (Blueprint $table) {
                $table->dropColumn('remarks');
            });
        }
    }
};
