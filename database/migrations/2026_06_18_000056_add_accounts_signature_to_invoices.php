<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Accounts Officer signs the bill itself.
 *
 * ⚠️ These are NOT the columns the forwarding letter uses. `signature_path` /
 * `signatory_user_id` (migration 000049) belong to the letter that travels
 * WITH the bill, and that letter is signed by whoever is sending it out —
 * usually a different officer, on a different day. The bill is a figure the
 * accounts desk vouches for, so it carries its own signature. Sharing one
 * column would mean signing the letter silently re-signed the bill.
 *
 * Only the PATH is stored, never the user_signatures id, so renaming or
 * deleting a signature later cannot change a bill that has already gone out.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'accounts_signature_path')) {
                $table->string('accounts_signature_path')->nullable()->after('status');
            }
            if (! Schema::hasColumn('invoices', 'accounts_signed_by')) {
                $table->foreignId('accounts_signed_by')->nullable()->after('accounts_signature_path')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('invoices', 'accounts_signed_at')) {
                $table->timestamp('accounts_signed_at')->nullable()->after('accounts_signed_by');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'accounts_signed_by')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropForeign(['accounts_signed_by']);
            });
        }

        Schema::table('invoices', function (Blueprint $table) {
            foreach (['accounts_signature_path', 'accounts_signed_by', 'accounts_signed_at'] as $column) {
                if (Schema::hasColumn('invoices', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
