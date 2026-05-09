<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operator_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_step_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('shift', ['morning', 'evening', 'night'])->default('morning');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operator_assignments');
    }
};
