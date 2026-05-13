<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $t) {
            // BITAC's outgoing dispatch/memo number — top-left of the letter
            // e.g. "36.06.2692.028.51.028(2).26.92"
            $t->string('memo_no', 80)->nullable()->after('customer_po_no');

            // Customer's reference letter we are responding to
            // e.g. "27.11.9100.406.01.701.26.86" dated 26/01/2026
            $t->string('customer_ref_no', 100)->nullable()->after('memo_no');
            $t->date('customer_ref_date')->nullable()->after('customer_ref_no');

            // Recipient block — shown at the top of the printed quote
            // (Executive Engineer, Sylhet 225 MW CCPP, BPDB, Kumargaon, Sylhet.)
            $t->text('recipient_block')->nullable()->after('customer_ref_date');

            // Numbered "দরপত্রের শর্ত সমূহ" (Terms & Conditions) — array of strings
            $t->json('terms')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $t) {
            $t->dropColumn(['memo_no', 'customer_ref_no', 'customer_ref_date', 'recipient_block', 'terms']);
        });
    }
};
