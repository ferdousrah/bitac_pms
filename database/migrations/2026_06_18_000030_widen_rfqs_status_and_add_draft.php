<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * RFQs can now be parked as `draft` — an unfinished request that IED is
 * still typing up. Drafts are autosaved from the RFQ form so a power cut
 * mid-entry doesn't lose the work, and they skip the "new RFQ" notification
 * + automation until they're actually submitted.
 *
 * Widening status from enum → varchar(20) means we don't have to keep
 * editing the enum every time the workflow grows a state.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE rfqs MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        // Any rows still sitting in `draft` would fail this — promote or
        // delete them before rolling back.
        DB::statement("ALTER TABLE rfqs MODIFY COLUMN status ENUM('pending','quoted','rejected') NOT NULL DEFAULT 'pending'");
    }
};
