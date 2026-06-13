<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a flat "Other Cost" amount on cost estimates — a one-shot charge
 * applied after Overhead, before VAT/Tax. Distinct from `other_cost`
 * which is the running total of section-D ("Other Parts") line items.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('cost_estimates', 'extra_cost')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->decimal('extra_cost', 14, 2)->default(0)->after('overhead_amount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cost_estimates', 'extra_cost')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->dropColumn('extra_cost');
            });
        }
    }
};
