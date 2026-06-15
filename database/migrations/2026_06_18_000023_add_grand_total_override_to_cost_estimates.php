<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Allow the planner to override the auto-computed Grand Total — useful for
 * rounding (e.g. ৳250,500 → ৳250,000) without rewriting upstream line items,
 * overhead, VAT, etc. Stored separately so the auto-value can still be shown
 * as the "calculated from" reference on the Show page + PDF.
 *
 * When NULL, recalculate() writes the math-derived value to grand_total.
 * When set, recalculate() honours the override — even after subsequent line edits.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('cost_estimates', 'grand_total_override')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->decimal('grand_total_override', 14, 2)->nullable()->after('grand_total');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cost_estimates', 'grand_total_override')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->dropColumn('grand_total_override');
            });
        }
    }
};
