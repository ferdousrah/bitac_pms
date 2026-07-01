<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * PCD gate passes go through an approval step: an entry user creates the pass
     * (pending_approval), then ANY ONE of the configured approvers approves it
     * (→ issued) or rejects it (→ rejected). IED passes stay direct-issue.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status ENUM('draft','pending_approval','issued','completed','cancelled','rejected') NOT NULL DEFAULT 'issued'");

        Schema::table('gate_passes', function (Blueprint $table) {
            $table->foreignId('approved_by')->nullable()->after('issuer_signature_path')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->string('approver_signature_path')->nullable()->after('approved_at');
            $table->foreignId('rejected_by')->nullable()->after('approver_signature_path')->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable()->after('rejected_by');
            $table->string('rejection_reason', 1000)->nullable()->after('rejected_at');
        });
    }

    public function down(): void
    {
        Schema::table('gate_passes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropConstrainedForeignId('rejected_by');
            $table->dropColumn(['approved_at', 'approver_signature_path', 'rejected_at', 'rejection_reason']);
        });
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status ENUM('draft','issued','completed','cancelled') NOT NULL DEFAULT 'issued'");
    }
};
