<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('operation_steps', function (Blueprint $t) {
            // Manual % weight per step — PCD officer assigns at operation sheet
            // creation. Sum across a sheet's steps should be 100. Job progress
            // is the sum of weights of completed steps.
            $t->decimal('weight_pct', 5, 2)->default(0)->after('estimated_hours');
        });
    }

    public function down(): void
    {
        Schema::table('operation_steps', function (Blueprint $t) {
            $t->dropColumn('weight_pct');
        });
    }
};
