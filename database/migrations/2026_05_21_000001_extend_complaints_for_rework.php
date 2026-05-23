<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wire complaints into the rework loop:
 *  - linked_ncr_id        : NCR raised when IED approves the complaint
 *  - linked_gate_pass_id  : Gate-In pass for the defective part return
 *  - accepted_at / by     : approval audit trail
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_complaints', function (Blueprint $table) {
            $table->foreignId('linked_ncr_id')->nullable()->after('responded_at')
                  ->constrained('ncrs')->nullOnDelete();
            $table->foreignId('linked_gate_pass_id')->nullable()->after('linked_ncr_id')
                  ->constrained('gate_passes')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable()->after('linked_gate_pass_id');
            $table->foreignId('accepted_by')->nullable()->after('accepted_at')
                  ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('customer_complaints', function (Blueprint $table) {
            $table->dropConstrainedForeignId('accepted_by');
            $table->dropColumn('accepted_at');
            $table->dropConstrainedForeignId('linked_gate_pass_id');
            $table->dropConstrainedForeignId('linked_ncr_id');
        });
    }
};
