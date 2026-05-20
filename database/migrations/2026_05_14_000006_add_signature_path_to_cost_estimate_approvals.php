<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('cost_estimate_approvals', function (Blueprint $t) {
            // Per-approval signature path on the public disk. Mirrors the
            // quotation_approvals pattern so the PDF can pick up the
            // approver's inline-drawn signature (falls back to user.signature_path).
            $t->string('signature_path', 255)->nullable()->after('remarks');
        });
    }

    public function down(): void
    {
        Schema::table('cost_estimate_approvals', function (Blueprint $t) {
            $t->dropColumn('signature_path');
        });
    }
};
