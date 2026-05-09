<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('topic')->nullable();
            $table->foreignId('host_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('meeting_code', 12)->unique();          // short join code
            $table->enum('status', ['waiting', 'active', 'ended'])->default('waiting');
            $table->json('presentation_state')->nullable();         // {slide_index, presentation_data}
            $table->json('meeting_notes')->nullable();              // auto-generated notes
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });

        Schema::create('meeting_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['host', 'participant', 'observer'])->default('participant');
            $table->boolean('is_online')->default(true);
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['meeting_id', 'user_id']);
        });

        Schema::create('meeting_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // null = Oli
            $table->enum('sender_type', ['user', 'ai', 'system'])->default('user');
            $table->text('content');
            $table->enum('message_type', ['chat', 'system', 'action', 'presentation', 'note'])->default('chat');
            $table->json('metadata')->nullable();                   // slide data, action items, etc.
            $table->timestamps();

            $table->index(['meeting_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_messages');
        Schema::dropIfExists('meeting_participants');
        Schema::dropIfExists('meetings');
    }
};
