<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Material demand — a shop asking PCD for material for a job (BITAC,
 * 2026-10-23: "Material Demand from every shop to PCD"). PCD answers it by
 * raising a material requisition to the store (`material_requisition_id`) or
 * by rejecting it with a reason. One demand → at most one requisition.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_demands', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('demand_no', 30)->unique();
            $t->foreignId('section_id')->constrained('sections');                 // the shop asking
            $t->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $t->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $t->date('needed_by')->nullable();
            $t->string('status', 20)->default('submitted');                        // submitted | accepted | rejected | cancelled
            $t->text('notes')->nullable();
            $t->foreignId('material_requisition_id')->nullable()->constrained('material_requisitions')->nullOnDelete();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->text('reject_reason')->nullable();
            $t->timestamps();

            $t->index(['center_id', 'status']);
        });

        Schema::create('material_demand_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('material_demand_id')->constrained('material_demands')->cascadeOnDelete();
            $t->foreignId('material_id')->constrained('materials');
            $t->text('description')->nullable();                                    // size / spec
            $t->string('unit', 20)->default('kg');
            $t->decimal('quantity', 12, 3);
            $t->string('remarks', 500)->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_demand_items');
        Schema::dropIfExists('material_demands');
    }
};
