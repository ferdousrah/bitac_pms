<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stamp the PCD officer who created the Operation Sheet — drives the
 * প্রস্তুতকারী (Prepared By) signature block on the printed PDF.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('operation_sheets', 'created_by')) {
            Schema::table('operation_sheets', function (Blueprint $table) {
                $table->foreignId('created_by')->nullable()->after('material')
                    ->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('operation_sheets', 'created_by')) {
            Schema::table('operation_sheets', function (Blueprint $table) {
                $table->dropForeign(['created_by']);
                $table->dropColumn('created_by');
            });
        }
    }
};
