<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('cost_estimates')) return;
        Schema::table('cost_estimates', function (Blueprint $t) {
            if (! Schema::hasColumn('cost_estimates', 'tax_pct')) {
                $t->decimal('tax_pct', 5, 2)->default(0)->after('vat_amount');
            }
            if (! Schema::hasColumn('cost_estimates', 'tax_amount')) {
                $t->decimal('tax_amount', 14, 2)->default(0)->after('tax_pct');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('cost_estimates')) return;
        Schema::table('cost_estimates', function (Blueprint $t) {
            if (Schema::hasColumn('cost_estimates', 'tax_amount')) $t->dropColumn('tax_amount');
            if (Schema::hasColumn('cost_estimates', 'tax_pct'))    $t->dropColumn('tax_pct');
        });
    }
};
