<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two dates BITAC types in, back-dated when the paper is older than the entry
 * (BITAC, from the 2026-10-10 job run-through):
 *
 * - `rfqs.customer_ref_date` — the date on the customer's own RFQ letter, beside
 *   the reference number already kept. It prefills the quotation's and the RFQ
 *   letter's customer-reference date (the quotation used the RFQ's entry date).
 * - `work_orders.pcd_wo_date` — the date PCD's work order (routing sheet) is
 *   issued on. NULL = the date the job reached PCD, which is what it printed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('rfqs', 'customer_ref_date')) {
            Schema::table('rfqs', fn (Blueprint $t) => $t->date('customer_ref_date')->nullable()->after('customer_ref_no'));
        }
        if (! Schema::hasColumn('work_orders', 'pcd_wo_date')) {
            Schema::table('work_orders', fn (Blueprint $t) => $t->date('pcd_wo_date')->nullable()->after('due_date'));
        }
    }

    public function down(): void
    {
        Schema::table('rfqs', fn (Blueprint $t) => $t->dropColumn('customer_ref_date'));
        Schema::table('work_orders', fn (Blueprint $t) => $t->dropColumn('pcd_wo_date'));
    }
};
