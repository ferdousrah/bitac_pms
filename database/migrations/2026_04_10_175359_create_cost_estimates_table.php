<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cost_estimates', function (Blueprint $table) {
            $table->id();
            $table->string('estimate_no', 30)->unique();
            $table->foreignId('rfq_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();

            // Header (matches Excel costing sheet)
            $table->string('company_name', 200)->nullable();
            $table->string('job_name', 200);
            $table->string('part_no', 50)->nullable();
            $table->string('actual_size', 100)->nullable();
            $table->string('materials_size', 100)->nullable();

            // Pricing group
            $table->enum('pricing_group', ['A', 'B', 'C'])->default('B');

            // Multipliers
            $table->decimal('overhead_pct',     6, 2)->default(0);
            $table->decimal('vat_pct',          6, 2)->default(15);
            $table->decimal('times_multiplier', 6, 2)->default(1);
            $table->unsignedInteger('job_quantity')->default(1);

            // Cached totals (recalculated on save)
            $table->decimal('material_cost', 12, 2)->default(0);
            $table->decimal('machining_cost', 12, 2)->default(0);
            $table->decimal('surface_cost',  12, 2)->default(0);
            $table->decimal('other_cost',    12, 2)->default(0);
            $table->decimal('net_cost',      12, 2)->default(0);
            $table->decimal('overhead_amount', 12, 2)->default(0);
            $table->decimal('vat_amount',    12, 2)->default(0);
            $table->decimal('total',         12, 2)->default(0);
            $table->decimal('grand_total',   12, 2)->default(0);

            $table->enum('status', ['draft', 'finalized', 'used'])->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });

        Schema::create('cost_estimate_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cost_estimate_id')->constrained()->cascadeOnDelete();
            $table->enum('section', ['material', 'machining', 'surface', 'other']);
            $table->foreignId('material_id')->nullable()->constrained('materials')->nullOnDelete();
            $table->foreignId('operation_id')->nullable()->constrained('machining_operations')->nullOnDelete();
            $table->string('description', 255);
            $table->decimal('quantity', 10, 3)->default(0);
            $table->string('unit', 20)->default('pcs');
            $table->decimal('rate', 10, 2)->default(0);
            $table->decimal('amount', 12, 2)->default(0);
            $table->unsignedSmallInteger('sequence')->default(0);
            $table->timestamps();

            $table->index(['cost_estimate_id', 'section']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cost_estimate_lines');
        Schema::dropIfExists('cost_estimates');
    }
};
