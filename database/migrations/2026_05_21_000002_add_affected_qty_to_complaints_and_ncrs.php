<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real-world: a customer may receive a lot of N items and only some are defective.
 * Track the affected quantity so rework + sample return + re-dispatch all use
 * the correct partial qty (e.g. 2 of 60 defective).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_complaints', function (Blueprint $table) {
            $table->unsignedInteger('affected_qty')->nullable()->after('message');
            $table->unsignedInteger('total_qty')->nullable()->after('affected_qty')
                  ->comment('Snapshot of WO quantity at the time the complaint was filed');
        });

        Schema::table('ncrs', function (Blueprint $table) {
            if (!Schema::hasColumn('ncrs', 'affected_qty')) {
                $table->unsignedInteger('affected_qty')->nullable()->after('defect_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_complaints', function (Blueprint $table) {
            $table->dropColumn(['affected_qty', 'total_qty']);
        });
        Schema::table('ncrs', function (Blueprint $table) {
            if (Schema::hasColumn('ncrs', 'affected_qty')) {
                $table->dropColumn('affected_qty');
            }
        });
    }
};
