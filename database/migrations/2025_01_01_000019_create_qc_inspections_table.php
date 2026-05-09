<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qc_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->onDelete('cascade');
            $table->foreignId('operation_step_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('inspector_id')->constrained('users')->onDelete('cascade');
            $table->enum('result', ['pass', 'fail', 'pending'])->default('pending');
            $table->date('inspection_date');
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qc_inspections');
    }
};
