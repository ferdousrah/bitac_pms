<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The delivery challan is signed by PCD's নির্বাহী প্রকৌশলী before the goods
 * go (BITAC, 2026-10-27) — App\Services\ChallanApproval.
 *
 * `challan_status`: pending (waiting for his signature) · approved · rejected.
 * ⚠️ Every challan raised before this is `approved` — they are already on the
 * road or delivered, and stopping them now would block deliveries and bills
 * that are already under way. They carry no signature (none was asked for).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_orders', function (Blueprint $t) {
            if (! Schema::hasColumn('delivery_orders', 'challan_status')) {
                // Who raised it — told when the XEN signs or rejects. Nothing
                // recorded it before; older rows stay NULL.
                $t->foreignId('created_by')->nullable()->after('challan_number')->constrained('users')->nullOnDelete();
                $t->string('challan_status', 20)->nullable()->after('status');
                $t->foreignId('challan_approved_by')->nullable()->after('challan_status')->constrained('users')->nullOnDelete();
                $t->timestamp('challan_approved_at')->nullable()->after('challan_approved_by');
                $t->string('challan_signature_path')->nullable()->after('challan_approved_at');
                $t->foreignId('challan_rejected_by')->nullable()->after('challan_signature_path')->constrained('users')->nullOnDelete();
                $t->timestamp('challan_rejected_at')->nullable()->after('challan_rejected_by');
                $t->string('challan_rejection_reason', 1000)->nullable()->after('challan_rejected_at');
            }
        });

        DB::table('delivery_orders')->whereNull('challan_status')->update(['challan_status' => 'approved']);

        // ⚠️ `status` was ENUM('scheduled','dispatched','delivered') — a
        // rejected challan cancels its delivery, and 'cancelled' did not fit
        // (MySQL refused the write). varchar(30), like every other status
        // column in this codebase. Not narrowed back on rollback: a cancelled
        // row would no longer fit.
        DB::statement("ALTER TABLE delivery_orders MODIFY status VARCHAR(30) NOT NULL DEFAULT 'scheduled'");
    }

    public function down(): void
    {
        Schema::table('delivery_orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('created_by');
            $t->dropConstrainedForeignId('challan_approved_by');
            $t->dropConstrainedForeignId('challan_rejected_by');
            $t->dropColumn(['challan_status', 'challan_approved_at', 'challan_signature_path',
                'challan_rejected_at', 'challan_rejection_reason']);
        });
    }
};
