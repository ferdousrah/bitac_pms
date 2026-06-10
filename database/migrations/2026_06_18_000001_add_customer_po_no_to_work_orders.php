<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            if (! Schema::hasColumn('work_orders', 'customer_po_no')) {
                $t->string('customer_po_no', 100)->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            if (Schema::hasColumn('work_orders', 'customer_po_no')) {
                $t->dropColumn('customer_po_no');
            }
        });
    }
};
