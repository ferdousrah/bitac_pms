<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->string('job_description', 500)->nullable()->after('notes');
            $table->string('customer_ref_no', 100)->nullable()->after('job_description');
        });
        // Make product_id nullable (job shop — customer may bring a new unique part)
        \DB::statement('ALTER TABLE rfqs MODIFY product_id BIGINT UNSIGNED NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropColumn(['job_description', 'customer_ref_no']);
        });
        \DB::statement('ALTER TABLE rfqs MODIFY product_id BIGINT UNSIGNED NOT NULL');
    }
};
