<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Add the same Student / Public columns to machining_operations so the
        // cost estimator can pull per-group rates for both machines and operations.
        Schema::table('machining_operations', function (Blueprint $t) {
            if (! Schema::hasColumn('machining_operations', 'rate_group_student')) {
                $t->decimal('rate_group_student', 10, 2)->nullable()->after('rate_group_c');
            }
            if (! Schema::hasColumn('machining_operations', 'rate_group_public')) {
                $t->decimal('rate_group_public', 10, 2)->nullable()->after('rate_group_student');
            }
        });

        // Widen the cost_estimates pricing_group enum to include the two new groups.
        // ENUM widening in MySQL requires a raw ALTER. Done outside the Schema closure.
        if (Schema::hasColumn('cost_estimates', 'pricing_group')) {
            DB::statement("ALTER TABLE cost_estimates MODIFY pricing_group ENUM('A','B','C','STUDENT','PUBLIC') NOT NULL DEFAULT 'B'");
        }
    }

    public function down(): void
    {
        Schema::table('machining_operations', function (Blueprint $t) {
            if (Schema::hasColumn('machining_operations', 'rate_group_public'))  $t->dropColumn('rate_group_public');
            if (Schema::hasColumn('machining_operations', 'rate_group_student')) $t->dropColumn('rate_group_student');
        });

        if (Schema::hasColumn('cost_estimates', 'pricing_group')) {
            // Reset any STUDENT/PUBLIC rows back to B before tightening the enum.
            DB::statement("UPDATE cost_estimates SET pricing_group = 'B' WHERE pricing_group IN ('STUDENT','PUBLIC')");
            DB::statement("ALTER TABLE cost_estimates MODIFY pricing_group ENUM('A','B','C') NOT NULL DEFAULT 'B'");
        }
    }
};
