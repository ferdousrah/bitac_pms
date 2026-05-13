<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quotation_approvals', function (Blueprint $t) {
            // Per-approval signature path (relative to public disk). Each round of
            // approve / request-changes / reject can carry its own captured
            // signature — strong audit trail showing exactly what was signed when.
            // If null, the PDF falls back to the user's saved signature.
            $t->string('signature_path', 255)->nullable()->after('remarks');
        });
    }

    public function down(): void
    {
        Schema::table('quotation_approvals', function (Blueprint $t) {
            $t->dropColumn('signature_path');
        });
    }
};
