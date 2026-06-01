<?php

use App\Models\WorkOrder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-item Work Orders. Each item carries its own job_number so a single
 * customer order with multiple parts can be tracked individually on the
 * shop floor while staying grouped under one WO.
 *
 * Backwards-compatible: existing WOs keep their product_id/quantity/job_number
 * columns (denormalised "first item"), and we backfill a single WorkOrderItem
 * row per legacy WO so downstream code can rely on the relation immediately.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('work_order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            // Job number per item — primary tracking identity downstream.
            $t->unsignedBigInteger('job_number')->nullable()->unique();
            // What is being produced
            $t->unsignedBigInteger('product_id')->nullable()->index();
            $t->unsignedBigInteger('rfq_item_id')->nullable()->index();
            $t->unsignedBigInteger('quotation_item_id')->nullable()->index();
            $t->string('description')->nullable();   // free-text fallback when no product
            $t->decimal('quantity', 12, 2);
            $t->string('unit', 20)->default('pcs');
            // Per-item progress / status (mirrors WO statuses for the most part)
            $t->string('status', 32)->default('pending');
            $t->unsignedInteger('display_order')->default(0);
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        // ── Backfill: 1 WorkOrderItem per existing WO ─────────────
        WorkOrder::query()->each(function (WorkOrder $wo) {
            \App\Models\WorkOrderItem::create([
                'work_order_id' => $wo->id,
                'job_number'    => $wo->job_number,
                'product_id'    => $wo->product_id,
                'quantity'      => $wo->quantity ?? 1,
                'unit'          => 'pcs',
                'status'        => $wo->status,
                'display_order' => 1,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_items');
    }
};
