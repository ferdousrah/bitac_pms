<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parts are costed individually, so each one carries its own quantity.
 *
 * The quantity is the TOTAL number of pieces for the whole order — not the
 * count per job unit. That means a job's cost is the plain sum of its part
 * estimates, with no further multiplication by the job quantity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rfq_item_parts', function (Blueprint $table) {
            $table->decimal('quantity', 10, 2)->default(1)->after('name');
            $table->string('unit', 20)->default('pcs')->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('rfq_item_parts', function (Blueprint $table) {
            $table->dropColumn(['quantity', 'unit']);
        });
    }
};
