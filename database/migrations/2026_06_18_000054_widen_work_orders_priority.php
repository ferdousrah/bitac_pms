<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `work_orders.priority` was ENUM('urgent','normal','low'), but the Issue
 * Work Order form offers High and the validation accepts it — so picking
 * High failed the insert with "Data truncated for column 'priority'". Every
 * page that shows a work order's priority already has a colour for 'high'.
 *
 * Widened to a varchar, the way status columns were, so the four values
 * the app uses (low / normal / high / urgent) all fit.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('work_orders', 'priority')) return;
        DB::statement("ALTER TABLE work_orders MODIFY COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal'");
    }

    public function down(): void
    {
        // No-op — narrowing back to the enum would truncate existing 'high' rows.
    }
};
