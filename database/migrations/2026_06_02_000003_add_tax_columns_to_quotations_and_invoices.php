<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tax is separate from VAT (typically AIT / Income Tax in Bangladesh).
 * Default 0 — opt-in per document.
 */
return new class extends Migration {
    public function up(): void
    {
        foreach (['quotations', 'invoices'] as $table) {
            if (! Schema::hasTable($table)) continue;
            Schema::table($table, function (Blueprint $t) use ($table) {
                if (! Schema::hasColumn($table, 'tax_rate')) {
                    $t->decimal('tax_rate', 5, 2)->default(0)->after('vat_amount');
                }
                if (! Schema::hasColumn($table, 'tax_amount')) {
                    $t->decimal('tax_amount', 14, 2)->default(0)->after('tax_rate');
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['quotations', 'invoices'] as $table) {
            if (! Schema::hasTable($table)) continue;
            Schema::table($table, function (Blueprint $t) use ($table) {
                if (Schema::hasColumn($table, 'tax_amount')) $t->dropColumn('tax_amount');
                if (Schema::hasColumn($table, 'tax_rate'))   $t->dropColumn('tax_rate');
            });
        }
    }
};
