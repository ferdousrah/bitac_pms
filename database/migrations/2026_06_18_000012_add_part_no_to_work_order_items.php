<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_order_items', function (Blueprint $table) {
            // PCD-entered part number for the item (free text, e.g. drawing/part ref).
            $table->string('part_no', 100)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('work_order_items', function (Blueprint $table) {
            $table->dropColumn('part_no');
        });
    }
};
