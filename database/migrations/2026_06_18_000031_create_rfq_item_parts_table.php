<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Individual parts that make up a single RFQ job item.
 *
 * A job item ("Re-metaling of journal bearing") can be broken down into the
 * discrete parts it covers. Only the part NAME is stored — the part number
 * is positional (`1/3`, `2/3`, `3/3`, derived from sort_order + sibling
 * count) so it always stays consecutive when a row is added or removed.
 * This mirrors the `n/total` convention already used on work order items.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rfq_item_parts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_item_id')->constrained('rfq_items')->cascadeOnDelete();
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->string('name', 255);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['rfq_item_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_item_parts');
    }
};
