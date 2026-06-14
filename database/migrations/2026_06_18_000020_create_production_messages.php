<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two-way query stream between Production shops and PCD, scoped per Operation
 * Sheet (which is itself per WO item). The operator at the shop floor asks
 * questions, attaches drawings / phone photos / marked-up sketches; PCD
 * replies inline. Thread is flat-chronological.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('production_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_sheet_id')->constrained()->cascadeOnDelete();
            // Section id is the section the message originated from (when posted
            // by the floor) — gives PCD context "this question came from Machine
            // Shop". NULL when PCD posts back.
            $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            // 'production' when the floor posts, 'pcd' when planning replies.
            // Drives the row colour + alignment on the thread UI.
            $table->enum('author_role', ['production', 'pcd']);
            $table->text('body');
            $table->timestamps();

            $table->index(['operation_sheet_id', 'created_at']);
        });

        Schema::create('production_message_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_message_id')->constrained()->cascadeOnDelete();
            $table->string('stored_path');
            $table->string('original_name', 255);
            $table->string('mime_type', 120)->nullable();
            $table->unsignedInteger('size')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_message_files');
        Schema::dropIfExists('production_messages');
    }
};
