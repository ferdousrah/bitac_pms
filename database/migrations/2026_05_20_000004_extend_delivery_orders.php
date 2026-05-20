<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * DeliveryController writes fields that never existed in the original schema.
 * Aligns the table with the controller + form.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_orders', 'quantity_delivered')) {
                $table->unsignedInteger('quantity_delivered')->default(0)->after('customer_id');
            }
            if (!Schema::hasColumn('delivery_orders', 'delivery_address')) {
                $table->text('delivery_address')->nullable()->after('scheduled_date');
            }
            if (!Schema::hasColumn('delivery_orders', 'vehicle_number')) {
                $table->string('vehicle_number', 60)->nullable()->after('delivery_address');
            }
            if (!Schema::hasColumn('delivery_orders', 'driver_name')) {
                $table->string('driver_name', 120)->nullable()->after('vehicle_number');
            }
            if (!Schema::hasColumn('delivery_orders', 'notes')) {
                $table->text('notes')->nullable()->after('driver_name');
            }
            if (!Schema::hasColumn('delivery_orders', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('delivery_orders', function (Blueprint $table) {
            foreach (['quantity_delivered','delivery_address','vehicle_number','driver_name','notes','delivered_at'] as $col) {
                if (Schema::hasColumn('delivery_orders', $col)) $table->dropColumn($col);
            }
        });
    }
};
