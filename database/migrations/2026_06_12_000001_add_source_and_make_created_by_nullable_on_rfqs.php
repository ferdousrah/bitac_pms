<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Source tracks where the RFQ originated — staff-created (existing
        // behavior) or self-served from the customer portal.
        Schema::table('rfqs', function (Blueprint $t) {
            if (! Schema::hasColumn('rfqs', 'source')) {
                $t->enum('source', ['staff', 'customer_portal'])->default('staff')->after('status');
            }
        });

        // Customer-portal RFQs have no staff user behind them, so created_by
        // needs to allow NULL. Drop the FK first, alter, then re-add.
        if (Schema::hasColumn('rfqs', 'created_by')) {
            Schema::table('rfqs', function (Blueprint $t) {
                try { $t->dropForeign(['created_by']); } catch (\Throwable $e) {}
            });
            Schema::table('rfqs', function (Blueprint $t) {
                $t->unsignedBigInteger('created_by')->nullable()->change();
            });
            Schema::table('rfqs', function (Blueprint $t) {
                try {
                    $t->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                } catch (\Throwable $e) {}
            });
        }
    }

    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            if (Schema::hasColumn('rfqs', 'source')) $t->dropColumn('source');
        });
        // Leave created_by alone — old rows may now have NULL.
    }
};
