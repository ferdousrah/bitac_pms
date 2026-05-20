<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds payment tracking fields to invoices so accounts can mark invoices
 * paid with proof — date, amount, method, reference (cheque no / TX id), and
 * an optional payment note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->timestamp('paid_at')->nullable()->after('issued_at');
            $table->decimal('paid_amount', 14, 2)->nullable()->after('paid_at');
            $table->string('payment_method', 30)->nullable()->after('paid_amount');
            $table->string('payment_reference', 100)->nullable()->after('payment_method');
            $table->text('payment_notes')->nullable()->after('payment_reference');
            $table->foreignId('marked_paid_by')->nullable()->after('payment_notes')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('marked_paid_by');
            $table->dropColumn(['paid_at', 'paid_amount', 'payment_method', 'payment_reference', 'payment_notes']);
        });
    }
};
