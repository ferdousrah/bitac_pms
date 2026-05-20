<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('gate_pass_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('gate_pass_id')->constrained('gate_passes')->cascadeOnDelete();

            // Optional link to the source RFQ item — lets us derive "gate status"
            // per RFQ item (e.g. "Sample at BITAC" / "Sample returned"). Pass may
            // also contain ad-hoc items not tied to any RFQ row.
            $t->foreignId('rfq_item_id')->nullable()->constrained('rfq_items')->nullOnDelete();

            $t->string('description', 500);
            $t->decimal('quantity', 12, 2)->default(1);
            $t->string('unit', 20)->default('pcs');

            // e.g. "Worn outer race, minor pitting" (gate-in) / "Re-machined, polished" (gate-out)
            $t->string('condition_note', 500)->nullable();

            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();

            $t->index('rfq_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gate_pass_items');
    }
};
