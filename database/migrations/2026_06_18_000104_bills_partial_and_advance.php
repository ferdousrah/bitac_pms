<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A job is billed in any of three ways (BITAC, 2026-11-02): an ADVANCE bill
 * before anything is delivered, a PARTIAL bill for the challans that have gone,
 * or a FULL bill for everything. App\Services\JobBilling holds the rules.
 *
 *  - invoices.kind            advance | delivery
 *  - invoices.goods_value     a delivery bill: the value of the goods on it
 *                             (VAT incl.); total_amount = goods − advance_adjusted
 *  - invoices.advance_adjusted the part of the job's advance bills this bill recovers
 *  - invoice_items            the bill's own lines (what was delivered, at the
 *                             quotation's unit price) — older bills have none
 *  - delivery_orders.invoice_id the bill a challan went on (one bill per challan)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->string('kind', 20)->default('delivery')->after('invoice_number');
            $t->decimal('goods_value', 14, 2)->nullable()->after('total_amount');
            $t->decimal('advance_adjusted', 14, 2)->default(0)->after('goods_value');
        });

        Schema::create('invoice_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('delivery_order_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('work_order_item_id')->nullable()->constrained()->nullOnDelete();
            $t->text('description')->nullable();
            $t->string('part_no', 30)->nullable();
            $t->string('unit', 20)->nullable();
            $t->decimal('quantity', 12, 2)->default(0);
            $t->decimal('unit_price', 14, 2)->default(0);     // VAT incl., as quoted
            $t->decimal('amount', 14, 2)->default(0);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::table('delivery_orders', function (Blueprint $t) {
            $t->foreignId('invoice_id')->nullable()->after('work_order_id')->constrained()->nullOnDelete();
        });

        // Every bill raised so far was raised from one delivery.
        DB::table('invoices')->whereNotNull('delivery_order_id')->orderBy('id')
            ->get(['id', 'delivery_order_id'])
            ->each(fn ($i) => DB::table('delivery_orders')->where('id', $i->delivery_order_id)
                ->whereNull('invoice_id')->update(['invoice_id' => $i->id]));
    }

    public function down(): void
    {
        Schema::table('delivery_orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('invoice_id');
        });
        Schema::dropIfExists('invoice_items');
        Schema::table('invoices', function (Blueprint $t) {
            $t->dropColumn(['kind', 'goods_value', 'advance_adjusted']);
        });
    }
};
