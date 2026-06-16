<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rfq_letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('center_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('rfq_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            // Official letter header
            $table->string('letter_no', 120)->nullable();   // নং / Memo No.
            $table->date('letter_date')->nullable();
            $table->string('subject', 255);
            $table->longText('body');                         // rich-text letter body
            $table->text('recipient_block')->nullable();      // bottom-left address
            $table->string('customer_ref_no', 150)->nullable();
            $table->date('customer_ref_date')->nullable();
            // Selectable signatory (bottom-right block)
            $table->foreignId('signatory_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('draft');   // draft | issued
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('emailed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_letters');
    }
};
