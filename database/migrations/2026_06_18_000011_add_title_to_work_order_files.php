<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a `title` column on work_order_files. The customer-issued work order
 * upload defaults this to "Customer Work Order" — searchable + display label
 * that's separate from the original filename and the freeform description.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('work_order_files', 'title')) {
            Schema::table('work_order_files', function (Blueprint $table) {
                $table->string('title', 150)->nullable()->after('original_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_order_files', 'title')) {
            Schema::table('work_order_files', function (Blueprint $table) {
                $table->dropColumn('title');
            });
        }
    }
};
