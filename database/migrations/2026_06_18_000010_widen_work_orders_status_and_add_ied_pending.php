<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Work Orders now route through an IED review step before they hit PCD.
 * Both customer-issued and staff-converted WOs start at `ied_pending`,
 * and only flip to `pcd_pending` after an IED officer accepts and forwards.
 *
 * Widening status from enum → varchar(30) means we don't have to keep
 * editing the enum every time we add a workflow state.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE work_orders MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ied_pending'");
    }

    public function down(): void
    {
        // Revert to the previous enum shape; values not in this list will fail —
        // run a data fix-up first if you've already seeded ied_pending rows.
        DB::statement("ALTER TABLE work_orders MODIFY COLUMN status ENUM('draft','pcd_pending','released_to_shops','approved','in_production','qc_hold','qc_passed','ready_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'draft'");
    }
};
