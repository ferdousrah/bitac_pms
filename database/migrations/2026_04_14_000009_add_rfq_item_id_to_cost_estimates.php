<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->foreignId('rfq_item_id')
                ->nullable()
                ->after('rfq_id')
                ->constrained('rfq_items')
                ->nullOnDelete();
            $table->index('rfq_item_id');
        });

        // Migrate existing estimates: attach each to the FIRST item of its RFQ
        DB::statement("
            UPDATE cost_estimates ce
            INNER JOIN (
                SELECT MIN(id) AS item_id, rfq_id
                FROM rfq_items
                GROUP BY rfq_id
            ) first_item ON first_item.rfq_id = ce.rfq_id
            SET ce.rfq_item_id = first_item.item_id
            WHERE ce.rfq_item_id IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->dropForeign(['rfq_item_id']);
            $table->dropColumn('rfq_item_id');
        });
    }
};
