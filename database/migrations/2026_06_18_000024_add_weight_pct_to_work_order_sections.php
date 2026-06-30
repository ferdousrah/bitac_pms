<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Section-level weightage: each shop in a work order's routing carries a
     * share of overall job progress (e.g. Casting 33.34%, Machine Shop 33.33%,
     * QC 33.33% — sums to 100). Replaces the confusing per-operation weight.
     */
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->decimal('weight_pct', 5, 2)->default(0)->after('sequence');
        });
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->dropColumn('weight_pct');
        });
    }
};
