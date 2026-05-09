<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->enum('response_type', ['accepted', 'rejected', 'revision_requested']);
            $table->string('customer_po_no', 100)->nullable();   // for accepted
            $table->text('feedback')->nullable();                 // reason / revision notes
            $table->date('response_date');
            $table->string('attachment_path', 500)->nullable();   // PO doc / feedback letter
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['quotation_id', 'response_type']);
        });

        // Quotation extensions for the customer response flow
        Schema::table('quotations', function (Blueprint $table) {
            $table->timestamp('sent_to_customer_at')->nullable()->after('status');
            $table->timestamp('customer_responded_at')->nullable()->after('sent_to_customer_at');
            $table->foreignId('parent_quotation_id')->nullable()->after('customer_responded_at')
                  ->constrained('quotations')->nullOnDelete();
            $table->string('customer_po_no', 100)->nullable()->after('parent_quotation_id');
        });

        // WO field for IED→PCD handoff
        Schema::table('work_orders', function (Blueprint $table) {
            $table->timestamp('pcd_handoff_at')->nullable()->after('status');
            $table->foreignId('pcd_handoff_by')->nullable()->after('pcd_handoff_at')
                  ->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['pcd_handoff_by']);
            $table->dropColumn(['pcd_handoff_at', 'pcd_handoff_by']);
        });
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropForeign(['parent_quotation_id']);
            $table->dropColumn(['sent_to_customer_at', 'customer_responded_at', 'parent_quotation_id', 'customer_po_no']);
        });
        Schema::dropIfExists('customer_responses');
    }
};
