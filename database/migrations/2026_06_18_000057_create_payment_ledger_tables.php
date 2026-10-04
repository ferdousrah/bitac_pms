<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The payment ledger — one row per money event against a client.
 *
 * A bill was settled all-or-nothing before this: `invoices.paid_amount` and a
 * "Mark as Paid" button. Real BITAC collections do not work that way — the
 * client pays an advance before the job, then the due in instalments, and
 * deducts security and tax at source out of the payment itself.
 *
 * ⚠️ **`kind` is what keeps the arithmetic honest.** Every row either moves
 * cash or moves the advance pool, never both:
 *
 *   advance          cash in, no bill yet          → +pool
 *   against_bill     cash in, settles a bill
 *   advance_applied  NO cash, settles a bill       → −pool
 *   security_release cash in, releases a retention
 *
 * So total cash received = Σ net over rows where kind <> 'advance_applied',
 * and an advance can be spread across the several partial bills one job
 * raises without an allocation table.
 *
 * ⚠️ **`payment_deduction_types.is_recoverable` decides whether a deduction
 * leaves a due.** Security withheld is BITAC's money held by the client, so
 * the bill is NOT settled for that part until it is released. Tax deducted at
 * source is paid to the treasury on BITAC's behalf against a challan, so it
 * DOES settle the bill. Get this backwards and either every bill stays
 * unpayable or every retention disappears from the dues.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Master: the kinds of deduction a client makes ──────────────────
        // National, like `sectors` and deliberately unlike the per-centre
        // master data: "how much security is held" has to be comparable
        // across centres, which per-centre rows with their own ids break.
        Schema::create('payment_deduction_types', function (Blueprint $t) {
            $t->id();
            $t->string('code', 40)->unique();
            $t->string('name', 120);
            $t->string('name_bn', 160)->nullable();
            // Held money that BITAC still gets back → still a due.
            $t->boolean('is_recoverable')->default(false);
            // A convenience default for the form; the officer can always type over it.
            $t->decimal('default_rate_pct', 6, 3)->nullable();
            $t->boolean('is_active')->default(true);
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        // ── The ledger ─────────────────────────────────────────────────────
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            // Money always belongs to a client. Restricted on delete, and the
            // customer screen refuses to delete a client who has any — a
            // receipt that vanishes with a master record is a hole in the books.
            $t->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            // The job the money is for. An advance is taken before any bill
            // exists, so this is how it is tied to the work.
            $t->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            // Set once the money is settling a specific bill.
            $t->foreignId('invoice_id')->nullable()->constrained('invoices')->cascadeOnDelete();

            // Auto from the register but editable, like a gate pass number.
            $t->string('payment_no', 40)->unique();
            $t->string('kind', 20)->default('against_bill');
            $t->date('paid_on');

            // What the client is settling. Net cash = gross − Σ deductions.
            $t->decimal('gross_amount', 15, 2)->default(0);

            $t->string('method', 30)->nullable();        // cash | cheque | bank_transfer | …
            $t->string('bank_branch', 160)->nullable();
            $t->string('reference', 120)->nullable();    // cheque / DD / transaction no
            $t->text('notes')->nullable();

            $t->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['customer_id', 'paid_on']);
            $t->index(['invoice_id', 'kind']);
            $t->index(['work_order_id', 'kind']);
        });

        // ── What was cut out of the payment ────────────────────────────────
        Schema::create('payment_deductions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            // Restricted: a type that has been used is deactivated, never
            // deleted, or a past deduction would lose what it was.
            $t->foreignId('deduction_type_id')->constrained('payment_deduction_types')->restrictOnDelete();
            $t->decimal('amount', 15, 2)->default(0);
            $t->string('note', 255)->nullable();
            // A recoverable deduction is released by a later payment; this is
            // the link back, so "security still held" is a plain subtraction.
            $t->foreignId('released_by_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $t->timestamps();

            $t->index(['deduction_type_id']);
        });

        // ── Proof: bank slip, cheque scan, treasury challan ───────────────
        Schema::create('payment_files', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $t->string('path', 255);
            $t->string('original_name', 255)->nullable();
            $t->string('label', 80)->nullable();          // Bank slip / Cheque / Treasury challan
            $t->string('mime', 120)->nullable();
            $t->unsignedBigInteger('size')->nullable();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        // BITAC's own list, so the module is usable the moment it deploys.
        // The admin can add to it; these are the ones that appear on their bills.
        $now = now();
        DB::table('payment_deduction_types')->insert([
            ['code' => 'security_deposit', 'name' => 'Security Deposit', 'name_bn' => 'নিরাপত্তা জামানত',
                'is_recoverable' => true, 'default_rate_pct' => 10, 'sort_order' => 1,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'performance_security', 'name' => 'Performance Security', 'name_bn' => 'কার্যসম্পাদন জামানত',
                'is_recoverable' => true, 'default_rate_pct' => null, 'sort_order' => 2,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'ait', 'name' => 'Income Tax at Source (AIT)', 'name_bn' => 'উৎসে আয়কর কর্তন',
                'is_recoverable' => false, 'default_rate_pct' => 5, 'sort_order' => 3,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'vat_at_source', 'name' => 'VAT Deducted at Source', 'name_bn' => 'উৎসে মূসক কর্তন',
                'is_recoverable' => false, 'default_rate_pct' => null, 'sort_order' => 4,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'revenue_stamp', 'name' => 'Revenue Stamp', 'name_bn' => 'রেভিনিউ স্ট্যাম্প',
                'is_recoverable' => false, 'default_rate_pct' => null, 'sort_order' => 5,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'bank_charge', 'name' => 'Bank Charge', 'name_bn' => 'ব্যাংক চার্জ',
                'is_recoverable' => false, 'default_rate_pct' => null, 'sort_order' => 6,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'liquidated_damages', 'name' => 'Liquidated Damages / Penalty', 'name_bn' => 'বিলম্ব জরিমানা',
                'is_recoverable' => false, 'default_rate_pct' => null, 'sort_order' => 7,
                'created_at' => $now, 'updated_at' => $now],
            ['code' => 'rounding', 'name' => 'Rounding Adjustment', 'name_bn' => 'রাউন্ডিং সমন্বয়',
                'is_recoverable' => false, 'default_rate_pct' => null, 'sort_order' => 8,
                'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_files');
        Schema::dropIfExists('payment_deductions');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('payment_deduction_types');
    }
};
