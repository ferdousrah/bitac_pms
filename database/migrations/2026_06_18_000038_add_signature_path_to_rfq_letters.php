<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot the signature a letter was issued with.
 *
 * RFQ letters used to render whatever signature the chosen signatory happened
 * to have on their profile at print time — so a reprint months later could come
 * out signed differently. Now that a user can hold several, the letter records
 * the image it was issued with, the same way quotation/cost-estimate approvals
 * and gate passes already snapshot theirs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rfq_letters', function (Blueprint $t) {
            // Relative to the `public` disk. Null = fall back to the signatory's
            // default signature at render time (how every old letter behaves).
            $t->string('signature_path', 255)->nullable()->after('signatory_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('rfq_letters', function (Blueprint $t) {
            $t->dropColumn('signature_path');
        });
    }
};
