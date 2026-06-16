<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            // When true, the VAT & Tax amounts are broken out on the PDF and the
            // customer portal. When false, the unit price is treated as all-inclusive
            // and the Grand Total simply reads "(incl. VAT & Tax)" — the BITAC
            // re-quotation convention (sample 36.06.2692.028.51.028(2).26.92).
            $table->boolean('show_tax_breakdown')->default(false)->after('tax_amount');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn('show_tax_breakdown');
        });
    }
};
