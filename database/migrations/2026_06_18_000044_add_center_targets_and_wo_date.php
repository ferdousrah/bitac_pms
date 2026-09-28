<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Target vs Achievement, in taka, per centre, per financial year.
 *
 * **Target** — one figure a centre admin sets for their own centre.
 *
 * **Achievement** — the value of work orders received, taken from the
 * quotation each work order is linked to (`work_orders.quotation_id` →
 * `quotations.total_amount`). If that quotation was revised, the linked
 * version's amount is the one that counts.
 *
 * ⚠️ Which financial year a work order lands in is decided by the **customer's
 * own work-order date**, not when it was keyed in. `work_orders` had
 * `customer_po_no` but no date to go with it, so `created_at` was the only
 * thing available — and that would put a January work order entered in July
 * into the wrong year. The column below fixes that; it stays nullable, and the
 * report falls back to `created_at` for the rows that predate it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $t) {
            $t->date('customer_wo_date')->nullable()->after('customer_po_no');
            $t->index('customer_wo_date');
        });

        Schema::create('center_targets', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->constrained()->cascadeOnDelete();
            // `2026-27`, `2027-28` … see App\Support\FinancialYear, which knows
            // that the cycle changes and that 2027-28 is only nine months.
            $t->string('financial_year', 9);
            $t->decimal('target_amount', 18, 2)->default(0);
            $t->string('note', 500)->nullable();
            $t->foreignId('set_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            // One figure per centre per year — the whole point of the screen.
            $t->unique(['center_id', 'financial_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('center_targets');

        Schema::table('work_orders', function (Blueprint $t) {
            $t->dropIndex(['customer_wo_date']);
            $t->dropColumn('customer_wo_date');
        });
    }
};
