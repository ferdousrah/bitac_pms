<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            if (! Schema::hasColumn('gate_passes', 'customer_id')) {
                $t->foreignId('customer_id')->nullable()->after('rfq_id')
                    ->constrained('customers')->nullOnDelete();
                $t->index('customer_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            if (Schema::hasColumn('gate_passes', 'customer_id')) {
                try { $t->dropForeign(['customer_id']); } catch (\Throwable $e) {}
                $t->dropColumn('customer_id');
            }
        });
    }
};
