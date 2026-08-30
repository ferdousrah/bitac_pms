<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A cost estimate can now be raised against a single PART of a job item
 * rather than the whole item.
 *
 * NULL keeps the old meaning — an estimate for the job item as a whole —
 * which is what jobs with no parts (and every existing estimate) use.
 *
 * A job's cost is then the sum of its parts' estimates; that sum is what
 * reaches the quotation. Parts themselves never appear on a quotation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->foreignId('rfq_item_part_id')
                ->nullable()
                ->after('rfq_item_id')
                ->constrained('rfq_item_parts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rfq_item_part_id');
        });
    }
};
