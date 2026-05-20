<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rework orders need to know WHICH section is responsible for the rework
 * so the system can route the job back into that section's production queue.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rework_orders', function (Blueprint $table) {
            $table->foreignId('target_section_id')->nullable()->after('original_work_order_id')
                  ->constrained('sections')->nullOnDelete();
            $table->foreignId('target_wos_id')->nullable()->after('target_section_id')
                  ->constrained('work_order_sections')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rework_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('target_wos_id');
            $table->dropConstrainedForeignId('target_section_id');
        });
    }
};
