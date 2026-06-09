<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('consultancy_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('request_number', 30)->unique();

            // Requester identity (public form, so no FK to users/customers)
            $t->enum('requester_type', ['student', 'consultancy', 'organization']);
            $t->string('requester_name', 150);
            $t->string('requester_email', 150);
            $t->string('requester_phone', 30);
            $t->string('organization_name', 200)->nullable();
            $t->string('designation_or_year', 150)->nullable();

            // Body
            $t->string('subject', 200);
            $t->text('description');
            $t->enum('preferred_mode', ['in_person', 'online', 'written']);
            $t->string('attachment_path')->nullable();

            // Workflow
            $t->enum('status', ['pending', 'accepted', 'rejected', 'completed', 'cancelled'])->default('pending');
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $t->text('response_notes')->nullable();
            $t->text('rejection_reason')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();

            $t->timestamps();

            $t->index('status');
            $t->index('requester_type');
            $t->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultancy_requests');
    }
};
