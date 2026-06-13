<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer-issued Work Orders are created without an authenticated staff user,
 * so `work_orders.created_by` needs to allow NULL. The pcd_handoff_by column
 * is also relaxed for the same reason — handoff happens later when IED
 * accepts, so it starts null on customer-issued rows too.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('created_by')->nullable()->change();
        });

        if (Schema::hasColumn('work_orders', 'pcd_handoff_by')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->unsignedBigInteger('pcd_handoff_by')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // No revert — existing rows may be null, and tightening the constraint
        // would break customer-issued WOs already in flight.
    }
};
