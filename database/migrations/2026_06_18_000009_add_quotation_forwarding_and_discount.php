<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Three feature additions on the quotation flow:
 *  1. Discount type alongside the existing `discount` amount column — lets
 *     the preparer offer a % or a fixed BDT discount.
 *  2. Forwarding letter — preparer-typed cover note that ships alongside
 *     the quotation as a separate PDF.
 *  3. Approval forwarding — an approver can hand off their pending row to
 *     someone outside the configured chain; that person's approval finalises
 *     the quotation.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            if (!Schema::hasColumn('quotations', 'discount_type')) {
                $table->string('discount_type', 10)->nullable()->after('discount'); // 'percent' or 'fixed'
            }
            if (!Schema::hasColumn('quotations', 'forwarding_letter')) {
                $table->text('forwarding_letter')->nullable()->after('terms');
            }
            if (!Schema::hasColumn('quotations', 'forwarding_letter_subject')) {
                $table->string('forwarding_letter_subject', 255)->nullable()->after('forwarding_letter');
            }
        });

        Schema::table('quotation_approvals', function (Blueprint $table) {
            if (!Schema::hasColumn('quotation_approvals', 'forwarded_to_user_id')) {
                $table->foreignId('forwarded_to_user_id')
                    ->nullable()
                    ->after('approver_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('quotation_approvals', 'forwarded_at')) {
                $table->timestamp('forwarded_at')->nullable()->after('forwarded_to_user_id');
            }
            if (!Schema::hasColumn('quotation_approvals', 'forward_reason')) {
                $table->text('forward_reason')->nullable()->after('forwarded_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            foreach (['discount_type', 'forwarding_letter', 'forwarding_letter_subject'] as $col) {
                if (Schema::hasColumn('quotations', $col)) $table->dropColumn($col);
            }
        });
        Schema::table('quotation_approvals', function (Blueprint $table) {
            if (Schema::hasColumn('quotation_approvals', 'forwarded_to_user_id')) {
                $table->dropForeign(['forwarded_to_user_id']);
                $table->dropColumn('forwarded_to_user_id');
            }
            foreach (['forwarded_at', 'forward_reason'] as $col) {
                if (Schema::hasColumn('quotation_approvals', $col)) $table->dropColumn($col);
            }
        });
    }
};
