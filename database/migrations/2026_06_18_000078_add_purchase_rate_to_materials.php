<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BITAC (2026-10-23): the material's `rate_per_kg` is the SELLING rate — what
 * a cost estimate charges the client. What BITAC itself pays is a different
 * figure, needed to work out what a job really spent on material.
 *
 * Nullable: none of the existing materials has one yet, and a blank must read
 * as "not entered", never as ৳0 (a zero purchase rate would make every job's
 * material cost look free).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('materials', 'purchase_rate_per_kg')) return;

        Schema::table('materials', function (Blueprint $t) {
            $t->decimal('purchase_rate_per_kg', 12, 2)->nullable()->after('rate_per_kg');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('materials', 'purchase_rate_per_kg')) return;

        Schema::table('materials', function (Blueprint $t) {
            $t->dropColumn('purchase_rate_per_kg');
        });
    }
};
