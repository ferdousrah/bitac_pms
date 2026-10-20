<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Want a quotation?" — requests sent in from the public website.
 *
 * ⚠️ **Not an RFQ.** An RFQ belongs to a customer record and enters IED's
 * pipeline (auto-estimate, PCD notification). A website request comes from
 * anybody, with no customer record and no vetting — so it lands in its own
 * inbox, and IED turns it into a DRAFT RFQ against a real customer once they
 * have read it (`rfq_id` records which).
 *
 * Attachments are uploaded by strangers, so they live on the PRIVATE disk and
 * are only ever served to signed-in staff.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('quotation_requests')) {
            Schema::create('quotation_requests', function (Blueprint $table) {
                $table->id();
                $table->string('reference_no', 30)->unique();
                $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
                // Which office the visitor asked — decides who answers it.
                $table->foreignId('site_office_id')->nullable()->constrained('site_offices')->nullOnDelete();

                $table->string('name', 150);
                $table->string('organisation', 200)->nullable();
                $table->string('designation', 150)->nullable();
                $table->string('email', 150);
                $table->string('phone', 40);
                $table->text('address')->nullable();

                $table->string('subject', 200);
                $table->text('description');
                $table->decimal('quantity', 12, 2)->nullable();
                $table->string('unit', 30)->nullable();
                $table->date('needed_by')->nullable();

                // new → in_review → converted | closed, or spam.
                $table->string('status', 20)->default('new')->index();
                $table->text('staff_note')->nullable();
                $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('handled_at')->nullable();
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->foreignId('rfq_id')->nullable()->constrained('rfqs')->nullOnDelete();
                $table->timestamp('converted_at')->nullable();

                $table->string('ip', 45)->nullable();
                $table->string('user_agent', 255)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('quotation_request_files')) {
            Schema::create('quotation_request_files', function (Blueprint $table) {
                $table->id();
                $table->foreignId('quotation_request_id')->constrained('quotation_requests')->cascadeOnDelete();
                $table->string('path');            // on the PRIVATE (local) disk
                $table->string('original_name');
                $table->string('mime', 120)->nullable();
                $table->unsignedBigInteger('size')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_request_files');
        Schema::dropIfExists('quotation_requests');
    }
};
