<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A delivery is FULL (every item of the job at once) or PARTIAL, and says per
 * job item how much went on its challan (BITAC, 2026-10-24: "একত্রে সকল মালামাল
 * ডেলিভারি অথবা আংশিক ডেলিভারি (Partial Challan)").
 *
 * - `delivery_order_items`: per job item, the quantity on this challan.
 *   `delivery_orders.quantity_delivered` stays the total (Σ of the lines), so
 *   every ledger that reads it — delivered qty, deliverable, billing, the
 *   Delivered vs Received report — keeps working unchanged.
 * - `delivery_orders.delivery_type`: full | partial. NULL on deliveries made
 *   before this; `DeliveryOrder::type` works those out from the quantity.
 * - `quantity_delivered` was an unsigned INT while job items carry decimals
 *   (`work_order_items.quantity` is decimal), so a line of 2.5 m could not
 *   add up into it. Widened to decimal(12,2), like the items.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('delivery_order_items')) {
            Schema::create('delivery_order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('delivery_order_id')->constrained('delivery_orders')->cascadeOnDelete();
                $table->foreignId('work_order_item_id')->nullable()->constrained('work_order_items')->nullOnDelete();
                $table->text('description')->nullable();
                $table->string('part_no', 30)->nullable();
                $table->string('unit', 20)->nullable();
                $table->decimal('quantity', 12, 2);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        Schema::table('delivery_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('delivery_orders', 'delivery_type')) {
                $table->string('delivery_type', 10)->nullable()->after('quantity_delivered');
            }
            $table->decimal('quantity_delivered', 12, 2)->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_order_items');
        Schema::table('delivery_orders', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_orders', 'delivery_type')) {
                $table->dropColumn('delivery_type');
            }
        });
    }
};
