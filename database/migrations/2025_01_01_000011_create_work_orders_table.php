<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('bom_id')->nullable()->constrained()->onDelete('set null');
            $table->string('wo_number')->unique();
            $table->decimal('quantity', 10, 2);
            $table->enum('status', [
                'draft', 'approved', 'in_production', 'qc_hold', 'qc_passed',
                'ready_for_delivery', 'delivered', 'cancelled'
            ])->default('draft');
            $table->enum('priority', ['urgent', 'normal', 'low'])->default('normal');
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_orders');
    }
};
