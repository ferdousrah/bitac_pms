<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_requisition_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->onDelete('cascade');
            $table->string('material_name');
            $table->string('material_code')->nullable();
            $table->decimal('required_qty', 10, 4);
            $table->decimal('available_qty', 10, 4)->default(0);
            $table->decimal('shortage_qty', 10, 4)->default(0);
            $table->string('unit')->default('kg');
            $table->enum('status', ['pending', 'issued', 'partial'])->default('pending');
            $table->foreignId('requested_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_requisition_notes');
    }
};
