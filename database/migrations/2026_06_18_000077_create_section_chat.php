<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Section chat (BITAC, 2026-10-21): one internal chat per section, which only
 * that section's people can read and answer, and one common chat for everyone
 * at the centre. A message can be posted as a নির্দেশনা (instruction), which
 * is pinned at the top of the chat.
 *
 * `section_id` NULL = the common chat. Every chat is per CENTRE — sections are
 * national, so Dhaka's CNC chat and Chattogram's are told apart by `center_id`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            // ⚠️ nullOnDelete, never cascade: deleting an account must not take
            // the conversation with it (see "Nobody deletes a staff account").
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->text('body')->nullable();
            $t->boolean('is_instruction')->default(false);
            $t->foreignId('reply_to_id')->nullable()->constrained('chat_messages')->nullOnDelete();
            $t->timestamp('deleted_at')->nullable();
            $t->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['center_id', 'section_id', 'id']);
            $t->index(['center_id', 'section_id', 'is_instruction']);
        });

        Schema::create('chat_message_files', function (Blueprint $t) {
            $t->id();
            $t->foreignId('chat_message_id')->constrained('chat_messages')->cascadeOnDelete();
            $t->string('path');
            $t->string('original_name');
            $t->string('mime', 120)->nullable();
            $t->unsignedBigInteger('size')->default(0);
            $t->timestamps();
        });

        // How far each person has read each chat — drives the unread counts.
        // `channel` is 'common' or the section id, because a NULL section_id
        // cannot take part in a UNIQUE index (MySQL treats NULLs as distinct).
        Schema::create('chat_reads', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('center_id')->nullable()->constrained('centers')->cascadeOnDelete();
            $t->string('channel', 20);
            $t->unsignedBigInteger('last_read_id')->default(0);
            $t->timestamps();

            $t->unique(['user_id', 'center_id', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_reads');
        Schema::dropIfExists('chat_message_files');
        Schema::dropIfExists('chat_messages');
    }
};
