<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Internal office notes — IED → Notes.
 *
 * Shaped like `rfq_letters` because the writing surface is the same, but a
 * note is **internal**: it prints on plain legal paper with no letterhead, it
 * goes to a colleague or another section rather than a customer, and it has no
 * RFQ or customer behind it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('office_notes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            // Typed by hand from the section's own register, like a letter number.
            $t->string('note_no', 120)->nullable();
            $t->date('note_date')->nullable();
            $t->string('subject', 255);
            $t->text('body');
            // Who it is addressed to — a person, a section, a desk.
            $t->string('recipient_block', 1000)->nullable();
            $t->foreignId('signatory_user_id')->nullable()->constrained('users')->nullOnDelete();
            // The signature image it was issued with, snapshotted as a path so a
            // later rename or delete cannot alter an issued note.
            $t->string('signature_path', 255)->nullable();
            $t->string('status', 20)->default('draft');   // draft | issued
            $t->timestamp('issued_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['center_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_notes');
    }
};
