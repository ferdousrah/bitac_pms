<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two-way conversation thread on cost estimates and quotations.
 * Lets preparers respond to approver correction notes without resubmitting,
 * and approvers clarify requirements.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_comments', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 60);                 // 'cost_estimate' | 'quotation'
            $table->unsignedBigInteger('entity_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->string('kind', 40)->default('comment');    // 'comment' | 'question' | 'clarification'
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_comments');
    }
};
