<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The bill's forwarding letter.
 *
 * Three documents travel to the customer together — **forwarding letter + bill
 * + মূসক ৬.৩** — and the letter is the one that carries the office's own
 * reference, the customer's reference and the signature. Same columns and the
 * same meanings as `quotations`, so `OfficialLetterRenderer` renders both
 * without knowing which it has.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'memo_no', 'forwarding_letter_subject', 'forwarding_letter', 'recipient_block',
        'customer_ref_no', 'customer_ref_date', 'signatory_user_id', 'signature_path',
        'letter_issued_at', 'emailed_at',
    ];

    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'memo_no')) {
                $table->string('memo_no', 120)->nullable()->after('invoice_number');
            }
            if (! Schema::hasColumn('invoices', 'forwarding_letter_subject')) {
                $table->string('forwarding_letter_subject')->nullable()->after('memo_no');
            }
            if (! Schema::hasColumn('invoices', 'forwarding_letter')) {
                $table->text('forwarding_letter')->nullable()->after('forwarding_letter_subject');
            }
            if (! Schema::hasColumn('invoices', 'recipient_block')) {
                $table->text('recipient_block')->nullable()->after('forwarding_letter');
            }
            if (! Schema::hasColumn('invoices', 'customer_ref_no')) {
                $table->string('customer_ref_no', 120)->nullable()->after('recipient_block');
            }
            if (! Schema::hasColumn('invoices', 'customer_ref_date')) {
                $table->date('customer_ref_date')->nullable()->after('customer_ref_no');
            }
            if (! Schema::hasColumn('invoices', 'signatory_user_id')) {
                $table->foreignId('signatory_user_id')->nullable()->after('customer_ref_date')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('invoices', 'signature_path')) {
                $table->string('signature_path')->nullable()->after('signatory_user_id');
            }
            if (! Schema::hasColumn('invoices', 'letter_issued_at')) {
                $table->timestamp('letter_issued_at')->nullable()->after('signature_path');
            }
            if (! Schema::hasColumn('invoices', 'emailed_at')) {
                $table->timestamp('emailed_at')->nullable()->after('letter_issued_at');
            }
        });
    }

    public function down(): void
    {
        // The foreign key has to go before its column, and a half-applied run
        // cannot be rolled back — so check each one.
        if (Schema::hasColumn('invoices', 'signatory_user_id')) {
            Schema::table('invoices', function (Blueprint $table) {
                $table->dropForeign(['signatory_user_id']);
            });
        }

        Schema::table('invoices', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                if (Schema::hasColumn('invoices', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
