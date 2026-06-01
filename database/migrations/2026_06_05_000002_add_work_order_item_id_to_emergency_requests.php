<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('emergency_requests', function (Blueprint $t) {
            // Null = applies to the whole WO; otherwise points at the specific item.
            $t->foreignId('work_order_item_id')->nullable()->after('work_order_id')
                ->constrained('work_order_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('emergency_requests', function (Blueprint $t) {
            $t->dropConstrainedForeignId('work_order_item_id');
        });
    }
};
