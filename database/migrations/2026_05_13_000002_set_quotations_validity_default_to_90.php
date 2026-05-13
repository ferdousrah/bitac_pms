<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // The Validity (days) input is no longer shown on the form — BITAC's
        // standard validity is 90 days. We change the column default so that
        // new rows without an explicit value get 90 automatically.
        DB::statement('ALTER TABLE quotations MODIFY COLUMN validity_days INT NOT NULL DEFAULT 90');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE quotations MODIFY COLUMN validity_days INT NOT NULL DEFAULT 30');
    }
};
