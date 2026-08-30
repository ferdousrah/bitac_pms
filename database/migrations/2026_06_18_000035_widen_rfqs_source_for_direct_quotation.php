<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Work often arrives as a straight quotation with no RFQ ever raised — the
 * customer just asks for a price on a job BITAC already knows how to do.
 *
 * The quotation form can now start from scratch, and the RFQ it needs is
 * created behind it rather than keyed in by hand. Those RFQs are marked
 * `direct_quotation` so the list makes clear nobody typed them.
 *
 * Widening source from enum → varchar(30) so the workflow can grow more
 * origins without another migration.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE rfqs MODIFY COLUMN source VARCHAR(30) NOT NULL DEFAULT 'staff'");
    }

    public function down(): void
    {
        // Rows sitting in 'direct_quotation' would fail this — move them first.
        DB::statement("ALTER TABLE rfqs MODIFY COLUMN source ENUM('staff','customer_portal') NOT NULL DEFAULT 'staff'");
    }
};
