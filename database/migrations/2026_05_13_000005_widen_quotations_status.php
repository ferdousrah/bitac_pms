<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // The original ENUM only had 5 values, but the code uses several more:
        //   sent_to_customer, revision_requested, customer_accepted,
        //   customer_rejected, superseded
        // Widen to varchar(40) so the controller can write any of these without
        // a "Data truncated" error.
        DB::statement("ALTER TABLE quotations MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE quotations MODIFY COLUMN status ENUM('draft','pending_approval','approved','rejected','converted') NOT NULL DEFAULT 'draft'");
    }
};
