<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Goods that come in on a gate pass eventually go back out again (and the
 * reverse), so a pass needs to record what was returned.
 *
 * Returns are recorded ITEM BY ITEM and can be partial — the same principle
 * the rest of the system follows for production, QC and delivery. Each
 * return carries its own note, and `returned_qty` on the item is the
 * denormalised running total.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gate_pass_items', function (Blueprint $table) {
            $table->decimal('returned_qty', 12, 2)->default(0)->after('quantity');
        });

        Schema::create('gate_pass_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gate_pass_id')->constrained('gate_passes')->cascadeOnDelete();
            $table->foreignId('gate_pass_item_id')->constrained('gate_pass_items')->cascadeOnDelete();
            $table->decimal('quantity', 12, 2);
            $table->date('returned_on');
            $table->text('note')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gate_pass_id', 'gate_pass_item_id']);
        });

        // A pass with some — but not all — of its goods back needs to be
        // visible as such. Widening to varchar so the workflow can grow.
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        Schema::dropIfExists('gate_pass_returns');
        Schema::table('gate_pass_items', function (Blueprint $table) {
            $table->dropColumn('returned_qty');
        });
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status ENUM('draft','pending_approval','issued','completed','cancelled','rejected') NOT NULL DEFAULT 'draft'");
    }
};
