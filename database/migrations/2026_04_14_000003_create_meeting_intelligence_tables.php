<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_action_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->text('description');
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assigned_to_name')->nullable();         // fallback if user not matched
            $table->date('due_date')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled'])->default('pending');
            $table->enum('priority', ['low', 'normal', 'high'])->default('normal');
            $table->text('context')->nullable();                    // surrounding discussion
            $table->foreignId('extracted_from_message_id')->nullable()->constrained('meeting_messages')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['meeting_id', 'status']);
            $table->index('assigned_to_user_id');
        });

        Schema::create('meeting_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->text('description');
            $table->text('context')->nullable();                    // why / rationale
            $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('decided_by_name')->nullable();
            $table->foreignId('extracted_from_message_id')->nullable()->constrained('meeting_messages')->nullOnDelete();
            $table->timestamps();

            $table->index('meeting_id');
        });

        Schema::create('meeting_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->integer('message_count')->default(0);
            $table->timestamp('discussed_at');
            $table->timestamps();

            $table->index('meeting_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_topics');
        Schema::dropIfExists('meeting_decisions');
        Schema::dropIfExists('meeting_action_items');
    }
};
