<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * QcController records fields that were never added to the table:
 *  inspection_type, qty_passed, qty_failed, notes, inspected_at.
 * Brings the schema in line with the controller + frontend form.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Make legacy NOT NULL columns nullable so they don't block inserts
        // from the new code path.
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE qc_inspections MODIFY inspection_date DATETIME NULL');
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE qc_inspections MODIFY remarks TEXT NULL');

        Schema::table('qc_inspections', function (Blueprint $table) {
            if (!Schema::hasColumn('qc_inspections', 'inspection_type')) {
                $table->string('inspection_type', 30)->default('final')->after('inspector_id');
            }
            if (!Schema::hasColumn('qc_inspections', 'qty_passed')) {
                $table->unsignedInteger('qty_passed')->default(0)->after('result');
            }
            if (!Schema::hasColumn('qc_inspections', 'qty_failed')) {
                $table->unsignedInteger('qty_failed')->default(0)->after('qty_passed');
            }
            if (!Schema::hasColumn('qc_inspections', 'notes')) {
                $table->text('notes')->nullable()->after('qty_failed');
            }
            if (!Schema::hasColumn('qc_inspections', 'inspected_at')) {
                $table->timestamp('inspected_at')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('qc_inspections', function (Blueprint $table) {
            foreach (['inspection_type', 'qty_passed', 'qty_failed', 'notes', 'inspected_at'] as $col) {
                if (Schema::hasColumn('qc_inspections', $col)) $table->dropColumn($col);
            }
        });
    }
};
