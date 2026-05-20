<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('gate_passes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->foreignId('rfq_id')->nullable()->constrained('rfqs')->nullOnDelete();

            // Public-facing identifier — auto-generated like GIN-2026-0001 / GOUT-2026-0001
            $t->string('pass_no', 40)->unique();

            // 'in'  = customer is bringing a sample / reference item INTO BITAC
            // 'out' = customer is taking it OUT of BITAC (after job is done, or rejected)
            $t->enum('direction', ['in', 'out']);

            // Customer's representative who physically brought / collected the item.
            // Captured at the gate so security has a paper trail.
            $t->string('customer_rep_name', 120)->nullable();
            $t->string('customer_rep_phone', 40)->nullable();
            $t->string('customer_rep_id_number', 60)->nullable(); // NID, employee ID, etc.
            $t->string('vehicle_no', 40)->nullable();

            $t->date('pass_date');
            $t->text('notes')->nullable();

            // The IED officer who issued the pass — their signature is captured
            // via the same canvas pad used for approvals.
            $t->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('issued_at')->nullable();
            $t->string('issuer_signature_path')->nullable();

            // draft = saved but not finalised; issued = active; cancelled = void
            $t->enum('status', ['draft', 'issued', 'cancelled'])->default('issued');

            $t->timestamps();

            $t->index(['rfq_id', 'direction']);
            $t->index(['status', 'pass_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gate_passes');
    }
};
