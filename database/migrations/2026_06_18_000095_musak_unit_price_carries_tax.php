<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * মূসক ৬.৩: the unit price carries the tax (AIT) when there is one; VAT is
 * still its own column (BITAC, 2026-10-31: "ekok mullo + tax jodi thake, vat
 * aladai dekhabe").
 *
 * `tax_rate` is the share of the unit price that is tax, so VAT can be worked
 * out on the price WITHOUT it — the quotation's own model, which makes the
 * challan's total equal the bill. Existing lines read 0: they were priced
 * without tax, and print exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('musak_challan_items', 'tax_rate')) {
            Schema::table('musak_challan_items', function (Blueprint $t) {
                $t->decimal('tax_rate', 8, 2)->default(0)->after('unit_price');
            });
        }
    }

    public function down(): void
    {
        Schema::table('musak_challan_items', function (Blueprint $t) {
            $t->dropColumn('tax_rate');
        });
    }
};
