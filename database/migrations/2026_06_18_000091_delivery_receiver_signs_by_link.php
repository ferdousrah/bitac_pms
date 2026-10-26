<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The person the client sends to collect the goods signs for them (BITAC,
 * 2026-10-27) — on his own phone through a one-time link, or a BITAC tablet,
 * or by pen on the paper challan which PCD then photographs.
 *
 * `proof_of_deliveries` already had `received_by`, `proof_type`, `proof_path`
 * and `delivered_at`. ⚠️ `DeliveryController@complete` was writing
 * `signature_path`, `received_at` and `notes`, which are neither columns nor
 * fillable — so the drawn signature was saved to disk and its path silently
 * dropped. `proof_type` = signature | photo and `proof_path` carry it now.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proof_of_deliveries', function (Blueprint $t) {
            if (! Schema::hasColumn('proof_of_deliveries', 'receiver_designation')) {
                $t->string('receiver_designation', 120)->nullable()->after('received_by');
                $t->string('receiver_phone', 40)->nullable()->after('receiver_designation');
                $t->text('notes')->nullable()->after('delivered_at');
                // Where a link signature came from — the receiver's phone.
                $t->string('signed_ip', 45)->nullable()->after('notes');
            }
        });

        Schema::table('delivery_orders', function (Blueprint $t) {
            if (! Schema::hasColumn('delivery_orders', 'receipt_token')) {
                // One-time link for the receiver to sign on (App\Services\DeliveryReceipt).
                $t->string('receipt_token', 64)->nullable()->unique()->after('challan_rejection_reason');
                $t->timestamp('receipt_token_expires_at')->nullable()->after('receipt_token');
            }
        });
    }

    public function down(): void
    {
        Schema::table('delivery_orders', function (Blueprint $t) {
            $t->dropUnique(['receipt_token']);
            $t->dropColumn(['receipt_token', 'receipt_token_expires_at']);
        });
        Schema::table('proof_of_deliveries', function (Blueprint $t) {
            $t->dropColumn(['receiver_designation', 'receiver_phone', 'notes', 'signed_ip']);
        });
    }
};
