<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['rfqs', 'cost_estimates', 'quotations', 'work_orders'] as $table) {
            if (! Schema::hasTable($table)) continue;
            if (Schema::hasColumn($table, 'job_category_id')) continue;
            Schema::table($table, function (Blueprint $t) {
                $t->unsignedBigInteger('job_category_id')->nullable()->after('id')->index();
            });
        }
    }

    public function down(): void
    {
        foreach (['rfqs', 'cost_estimates', 'quotations', 'work_orders'] as $table) {
            if (! Schema::hasTable($table)) continue;
            if (! Schema::hasColumn($table, 'job_category_id')) continue;
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn('job_category_id');
            });
        }
    }
};
