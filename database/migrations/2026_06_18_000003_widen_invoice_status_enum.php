<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Original schema set status to ENUM('draft','issued','acknowledged')
        // — too narrow to hold 'paid', 'overdue', etc. Switch to a wider
        // varchar so we can use any of the status values the app already
        // writes (paid, overdue, cancelled) without adding new migrations
        // every time a new state is introduced.
        if (! Schema::hasColumn('invoices', 'status')) return;
        DB::statement("ALTER TABLE invoices MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        // No-op — we don't downgrade to the narrow enum because that would
        // truncate existing 'paid' / 'overdue' rows.
    }
};
