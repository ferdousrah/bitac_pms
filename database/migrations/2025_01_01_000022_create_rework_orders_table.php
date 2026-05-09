<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rework_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ncr_id')->constrained()->onDelete('cascade');
            $table->foreignId('original_work_order_id')->constrained('work_orders')->onDelete('cascade');
            $table->string('rework_wo_number')->unique();
            $table->string('status')->default('open');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rework_orders');
    }
};
