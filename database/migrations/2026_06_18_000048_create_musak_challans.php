<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * মূসক ৬.৩ — কর চালানপত্র, the NBR VAT challan.
 *
 * Header and line figures are STORED, not derived. A tax challan is a legal
 * document: once it is issued, what it printed must not change because someone
 * later edited the customer's address, the centre's BIN or the quotation's
 * rate. Everything on the form is an editable field, prefilled from the
 * invoice, and kept on the row.
 */
return new class extends Migration
{
    public function up(): void
    {
        // BITAC's own BIN, per centre — it goes in নিবন্ধিত ব্যক্তির বিআইএন.
        if (! Schema::hasColumn('centers', 'bin_number')) {
            Schema::table('centers', function (Blueprint $table) {
                $table->string('bin_number', 40)->nullable()->after('code');
            });
        }

        // ক্রেতার বিআইএন (প্রযোজ্য ক্ষেত্রে). InvoiceService already read
        // `customers.bin_number` — the column simply never existed, so the tax
        // invoice has always printed a blank there.
        if (! Schema::hasColumn('customers', 'bin_number')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('bin_number', 40)->nullable()->after('address');
            });
        }

        if (! Schema::hasTable('musak_challans')) {
            Schema::create('musak_challans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();

                // Where it came from. All nullable — a challan can be raised on
                // its own, and deleting an invoice must never take a tax
                // document with it.
                $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
                $table->foreignId('delivery_order_id')->nullable()->constrained('delivery_orders')->nullOnDelete();
                $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();

                $table->string('challan_no', 60)->nullable();
                $table->date('issue_date')->nullable();
                $table->time('issue_time')->nullable();          // ইস্যুর সময় — the form asks for both

                // Supplier — নিবন্ধিত ব্যক্তি (BITAC)
                $table->string('supplier_name')->nullable();
                $table->string('supplier_bin', 40)->nullable();
                $table->text('supplier_address')->nullable();

                // Buyer — ক্রেতা
                $table->string('buyer_name')->nullable();
                $table->string('buyer_bin', 40)->nullable();
                $table->text('buyer_address')->nullable();

                $table->string('destination')->nullable();       // সরবরাহের গন্তব্যস্থল
                $table->string('vehicle')->nullable();           // যানবাহনের প্রকৃতি ও নম্বর

                // Footer figures, as printed.
                $table->decimal('total_value', 15, 2)->default(0);        // col ৬
                $table->decimal('total_sd', 15, 2)->default(0);           // col ৮
                $table->decimal('total_vat', 15, 2)->default(0);          // col ১০
                $table->decimal('total_inclusive', 15, 2)->default(0);    // col ১১

                $table->foreignId('signatory_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('signature_path')->nullable();
                $table->text('note')->nullable();

                $table->string('status', 20)->default('draft');  // draft | issued
                $table->timestamp('issued_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['center_id', 'issue_date']);
                $table->index('challan_no');
            });
        }

        if (! Schema::hasTable('musak_challan_items')) {
            Schema::create('musak_challan_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('musak_challan_id')->constrained('musak_challans')->cascadeOnDelete();
                $table->unsignedInteger('sort_order')->default(0);

                $table->text('description')->nullable();                  // col ২
                $table->string('unit', 40)->nullable();                   // col ৩
                $table->decimal('quantity', 15, 3)->default(0);           // col ৪
                $table->decimal('unit_price', 15, 2)->default(0);         // col ৫ — excluding all tax
                $table->decimal('total_value', 15, 2)->default(0);        // col ৬
                $table->decimal('sd_rate', 8, 2)->default(0);             // col ৭
                $table->decimal('sd_amount', 15, 2)->default(0);          // col ৮
                $table->decimal('vat_rate', 8, 2)->default(0);            // col ৯
                $table->decimal('vat_amount', 15, 2)->default(0);         // col ১০
                $table->decimal('total_inclusive', 15, 2)->default(0);    // col ১১

                $table->timestamps();
                $table->index(['musak_challan_id', 'sort_order']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('musak_challan_items');
        Schema::dropIfExists('musak_challans');

        if (Schema::hasColumn('customers', 'bin_number')) {
            Schema::table('customers', fn (Blueprint $t) => $t->dropColumn('bin_number'));
        }
        if (Schema::hasColumn('centers', 'bin_number')) {
            Schema::table('centers', fn (Blueprint $t) => $t->dropColumn('bin_number'));
        }
    }
};
