<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds an explicit memo date on quotations — printed in the "Date" slot of
 * the BITAC letter (top-right of the document, next to "নং -"). Defaults to
 * `created_at` if blank, so the document always carries a date stamp.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('quotations', 'memo_date')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->date('memo_date')->nullable()->after('memo_no');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quotations', 'memo_date')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->dropColumn('memo_date');
            });
        }
    }
};
