<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            // The WorkOrder model already lists rfq_id in fillable + has an rfq()
            // relation, but the column was never created. PCD pages join through
            // this column to fetch job items — without it, "Job Items" stayed empty.
            $t->foreignId('rfq_id')->nullable()->after('quotation_id')->constrained('rfqs')->nullOnDelete();
        });

        // Backfill: for existing work orders, copy rfq_id from the linked quotation
        // so legacy jobs (created before this column existed) render properly too.
        DB::statement('
            UPDATE work_orders wo
            INNER JOIN quotations q ON q.id = wo.quotation_id
            SET wo.rfq_id = q.rfq_id
            WHERE wo.rfq_id IS NULL AND q.rfq_id IS NOT NULL
        ');
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('rfq_id');
        });
    }
};
