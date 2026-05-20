<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds Quality Control (পর্যবেক্ষণ) field to:
 *  - work_order_sections : QC instruction for the shop while routing
 *  - operation_steps     : QC checkpoint instruction per machining step
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->text('qc_notes')->nullable()->after('notes');
        });

        Schema::table('operation_steps', function (Blueprint $table) {
            $table->text('qc_notes')->nullable()->after('tooling_notes');
        });
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->dropColumn('qc_notes');
        });
        Schema::table('operation_steps', function (Blueprint $table) {
            $table->dropColumn('qc_notes');
        });
    }
};
