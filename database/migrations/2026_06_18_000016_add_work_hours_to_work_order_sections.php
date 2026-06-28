<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            // PCD-entered planned working time / hours for the section (free text,
            // e.g. "2.5" or "2 hrs"). Shown on the Work Order PDF.
            $table->string('work_hours', 50)->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->dropColumn('work_hours');
        });
    }
};
