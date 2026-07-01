<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pool of users allowed to approve PCD gate passes. Any ONE of them
     * approving finalises a pass. Managed under Users & Access.
     */
    public function up(): void
    {
        Schema::create('gate_pass_approvers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gate_pass_approvers');
    }
};
