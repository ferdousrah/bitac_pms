<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Widen `work_orders.status` to include the PCD-phase states the code already
 * writes via Eloquent (`pcd_pending`, `released_to_shops`). Without these in
 * the enum, MySQL truncates the value to '' and the insert fails with 1265.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE work_orders MODIFY COLUMN status ENUM(
                'draft',
                'pcd_pending',
                'released_to_shops',
                'approved',
                'in_production',
                'qc_hold',
                'qc_passed',
                'ready_for_delivery',
                'delivered',
                'cancelled'
            ) NOT NULL DEFAULT 'draft'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE work_orders MODIFY COLUMN status ENUM(
                'draft',
                'approved',
                'in_production',
                'qc_hold',
                'qc_passed',
                'ready_for_delivery',
                'delivered',
                'cancelled'
            ) NOT NULL DEFAULT 'draft'
        ");
    }
};
