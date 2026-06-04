<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The original `machines.status` enum was ('active','maintenance','breakdown')
 * but the controller + form have long since standardised on
 * ('operational','maintenance','offline'). Saving an edit with the new values
 * silently truncates in MySQL strict mode → SQLSTATE[01000].
 *
 * Strategy:
 *   1. Temporarily widen the enum so we can migrate values.
 *   2. Map legacy values: active → operational, breakdown → offline.
 *   3. Tighten the enum to the canonical set.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('machines', 'status')) return;

        DB::statement("ALTER TABLE machines MODIFY status
            ENUM('active','operational','maintenance','breakdown','offline')
            NOT NULL DEFAULT 'operational'");

        DB::statement("UPDATE machines SET status = 'operational' WHERE status = 'active'");
        DB::statement("UPDATE machines SET status = 'offline'     WHERE status = 'breakdown'");

        DB::statement("ALTER TABLE machines MODIFY status
            ENUM('operational','maintenance','offline')
            NOT NULL DEFAULT 'operational'");
    }

    public function down(): void
    {
        if (! Schema::hasColumn('machines', 'status')) return;

        DB::statement("ALTER TABLE machines MODIFY status
            ENUM('active','operational','maintenance','breakdown','offline')
            NOT NULL DEFAULT 'active'");

        DB::statement("UPDATE machines SET status = 'active'    WHERE status = 'operational'");
        DB::statement("UPDATE machines SET status = 'breakdown' WHERE status = 'offline'");

        DB::statement("ALTER TABLE machines MODIFY status
            ENUM('active','maintenance','breakdown')
            NOT NULL DEFAULT 'active'");
    }
};
