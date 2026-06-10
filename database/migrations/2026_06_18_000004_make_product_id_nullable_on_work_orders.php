<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // BITAC takes a lot of bespoke / one-off jobs where the customer
        // describes the part in free text rather than selecting from the
        // BITAC product catalog. Those jobs have no product_id, so the
        // column must allow NULL — otherwise Quotation → WO conversion
        // fails with a NOT NULL violation.
        if (! Schema::hasColumn('work_orders', 'product_id')) return;

        Schema::table('work_orders', function (Blueprint $t) {
            try { $t->dropForeign(['product_id']); } catch (\Throwable $e) {}
        });
        Schema::table('work_orders', function (Blueprint $t) {
            $t->unsignedBigInteger('product_id')->nullable()->change();
        });
        Schema::table('work_orders', function (Blueprint $t) {
            try {
                $t->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            } catch (\Throwable $e) {}
        });
    }

    public function down(): void
    {
        // No-op — re-enforcing NOT NULL would fail on existing legitimate
        // NULL rows. If you really need it back, scrub the rows first.
    }
};
