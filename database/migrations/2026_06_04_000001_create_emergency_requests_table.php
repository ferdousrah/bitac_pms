<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('emergency_requests', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('center_id')->nullable()->index();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('customer_id')->constrained()->cascadeOnDelete();
            // Customer side identity (kept even if customer account is replaced)
            $t->string('requester_name')->nullable();
            $t->string('requester_contact')->nullable();
            // The ask
            $t->text('reason');
            $t->date('needed_by')->nullable();
            $t->enum('requested_priority', ['urgent', 'normal'])->default('urgent');
            // Workflow
            $t->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $t->unsignedBigInteger('reviewed_by')->nullable();
            $t->timestamp('reviewed_at')->nullable();
            $t->text('review_notes')->nullable();
            // Snapshot of WO priority before approval, so we can revert / audit
            $t->string('original_priority')->nullable();
            $t->timestamps();
            $t->index(['status', 'work_order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emergency_requests');
    }
};
