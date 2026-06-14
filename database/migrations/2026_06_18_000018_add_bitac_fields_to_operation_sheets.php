<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Match BITAC's paper Operation Sheet header:
 *   - কাজের নামঃ   (Job Title) — inherits from item description by default,
 *                  PCD can override on the form
 *   - কাজের বিবরণঃ  (Job Description) — free-form spec note (e.g. "As per Sample")
 *   - ম্যাটেরিয়ালঃ (Material) — material grade (e.g. "EN-24")
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('operation_sheets', function (Blueprint $table) {
            if (!Schema::hasColumn('operation_sheets', 'job_title')) {
                $table->string('job_title', 250)->nullable()->after('sheet_number');
            }
            if (!Schema::hasColumn('operation_sheets', 'job_description')) {
                $table->text('job_description')->nullable()->after('job_title');
            }
            if (!Schema::hasColumn('operation_sheets', 'material')) {
                $table->string('material', 200)->nullable()->after('job_description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('operation_sheets', function (Blueprint $table) {
            foreach (['job_title', 'job_description', 'material'] as $col) {
                if (Schema::hasColumn('operation_sheets', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
