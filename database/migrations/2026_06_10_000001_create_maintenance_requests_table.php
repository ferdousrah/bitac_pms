<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('maintenance_requests', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('center_id')->nullable()->index();

            // What & where
            $t->foreignId('machine_id')->constrained()->cascadeOnDelete();
            $t->foreignId('section_id')->nullable()->constrained()->nullOnDelete();

            // Who reported
            $t->foreignId('requested_by')->constrained('users');

            // The problem
            $t->text('reported_problem');
            $t->enum('urgency', ['urgent', 'normal', 'low'])->default('normal');
            $t->decimal('expected_downtime_hours', 6, 2)->nullable();
            $t->json('attachment_paths')->nullable(); // list of stored paths

            // Workflow state
            $t->enum('status', [
                'pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'
            ])->default('pending');

            // Approval audit
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->text('review_notes')->nullable();

            // Execution audit
            $t->timestamp('started_at')->nullable();
            $t->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('completed_at')->nullable();
            $t->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();

            // Cancellation audit
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $t->text('cancellation_reason')->nullable();

            // Cross-links
            $t->foreignId('maintenance_log_id')->nullable()
                ->constrained('machine_maintenance_logs')->nullOnDelete();
            $t->string('machine_state_before', 32)->nullable();

            $t->timestamps();
            $t->index(['status', 'machine_id']);
            $t->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_requests');
    }
};
