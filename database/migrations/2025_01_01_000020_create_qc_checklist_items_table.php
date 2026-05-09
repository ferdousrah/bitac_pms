<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qc_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qc_inspection_id')->constrained()->onDelete('cascade');
            $table->string('check_description');
            $table->string('measurement')->nullable();
            $table->string('tolerance')->nullable();
            $table->enum('result', ['pass', 'fail'])->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qc_checklist_items');
    }
};
