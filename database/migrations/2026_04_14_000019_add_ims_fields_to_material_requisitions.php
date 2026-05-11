<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Material Requisitions flow through to BITAC's IMS (Inventory Management System)
 * for approval + issuance. PMS just pushes the request; IMS handles the rest.
 *
 * New columns track that push so we can show status + retry / reconcile later.
 * New `sent_to_ims` status separates "we pushed it" from "draft" and "approved".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requisitions', function (Blueprint $table) {
            $table->string('ims_reference', 60)->nullable()->after('status'); // IMS's own MRN/transaction id
            $table->timestamp('ims_pushed_at')->nullable()->after('ims_reference');
            $table->foreignId('ims_pushed_by')->nullable()->after('ims_pushed_at')->constrained('users')->nullOnDelete();
            $table->string('ims_status', 40)->nullable()->after('ims_pushed_by');       // raw status from IMS (free-text)
            $table->text('ims_last_error')->nullable()->after('ims_status');
            $table->json('ims_response')->nullable()->after('ims_last_error');          // last response payload for audit
        });

        // Widen status enum to include `sent_to_ims`
        DB::statement("
            ALTER TABLE material_requisitions MODIFY COLUMN status ENUM(
                'draft',
                'pending_approval',
                'sent_to_ims',
                'approved',
                'partially_issued',
                'issued',
                'received',
                'cancelled'
            ) NOT NULL DEFAULT 'draft'
        ");
    }

    public function down(): void
    {
        Schema::table('material_requisitions', function (Blueprint $table) {
            $table->dropForeign(['ims_pushed_by']);
            $table->dropColumn(['ims_reference', 'ims_pushed_at', 'ims_pushed_by', 'ims_status', 'ims_last_error', 'ims_response']);
        });
        DB::statement("
            ALTER TABLE material_requisitions MODIFY COLUMN status ENUM(
                'draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'received', 'cancelled'
            ) NOT NULL DEFAULT 'draft'
        ");
    }
};
