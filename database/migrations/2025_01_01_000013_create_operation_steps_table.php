<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operation_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_sheet_id')->constrained()->onDelete('cascade');
            $table->integer('sequence');
            $table->string('operation_name');
            $table->foreignId('machine_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('estimated_hours', 8, 2)->default(0);
            $table->text('tooling_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operation_steps');
    }
};
