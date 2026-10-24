<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A maintenance request is Electrical or Mechanical (BITAC, 2026-10-24) —
 * each has its own menu. Requests raised before this read as mechanical
 * (the column default): a machine fault was the only thing the form asked
 * about, and most of them are.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('maintenance_requests', 'category')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                $table->string('category', 20)->default('mechanical')->after('section_id')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('maintenance_requests', 'category')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                $table->dropIndex(['category']);
                $table->dropColumn('category');
            });
        }
    }
};
