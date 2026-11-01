<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Billing & Accounts → Money Receipt (BITAC, 2026-11-01): the receipt BITAC
 * hands an organisation that pays in cash or by cheque — the printed receipt
 * book, kept here. A book of its own: it does NOT touch the payment ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('money_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->string('receipt_no', 40)->unique();
            $table->date('receipt_date');
            // The organisation — picked from the clients, its name kept as it was.
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('payer_name');
            $table->string('purpose', 500);                 // অত্র কেন্দ্রের … বাবদ
            $table->string('method', 20)->default('cash');  // cash | cheque
            $table->string('cheque_no', 60)->nullable();
            $table->date('cheque_date')->nullable();
            $table->string('bank_name', 160)->nullable();
            $table->string('received_through', 160)->nullable(); // মারফত
            $table->decimal('amount', 15, 2);
            $table->string('details', 500)->nullable();     // e.g. ৩০ জন × ২৬০
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->string('status', 20)->default('issued'); // issued | cancelled
            $table->string('cancel_reason', 500)->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['center_id', 'receipt_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('money_receipts');
    }
};
