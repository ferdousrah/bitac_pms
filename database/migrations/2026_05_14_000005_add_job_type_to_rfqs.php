<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            // Distinguishes routine production jobs from research/prototype work.
            // R&D jobs may follow different costing/approval rules in future.
            $t->enum('job_type', ['regular', 'rnd'])->default('regular')->after('reference_type');
        });
    }

    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            $t->dropColumn('job_type');
        });
    }
};
