<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Billing & Accounts → AIT Records / VAT Records (BITAC, 2026-11-01): what a
 * client deducted at source from BITAC's bills — AIT (with the tax deduction
 * certificate) and VAT (with the মূসক ৬.৬ certificate / treasury challan).
 *
 * ⚠️ A register KEPT BY HAND, deliberately not derived from the payment
 * ledger's deductions (BITAC's choice), so the two can differ. One table for
 * both, told apart by `kind`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_records', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('kind', 10);                       // ait | vat
            $t->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $t->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $t->string('bill_ref', 120)->nullable();      // a bill typed by hand (not in the system)
            $t->date('record_date');
            $t->string('certificate_no', 120)->nullable();
            $t->decimal('amount', 15, 2);
            $t->text('remarks')->nullable();
            $t->string('file_path')->nullable();
            $t->string('file_name')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['center_id', 'kind', 'record_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_records');
    }
};
