<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A Gate Pass Out raised against a Gate Pass In.
 *
 * Something gated IN to IED usually goes back out once the work is done, and
 * that exit needs its own paper — a GOUT number the gate keeps and the
 * customer's representative signs. `gate_pass_returns` already recorded *how
 * much* went back, but it is only a record; there was no document.
 *
 * Three links, so the chain reads both ways:
 *   gate_passes.source_gate_pass_id        the In pass this Out answers
 *   gate_pass_items.source_gate_pass_item_id  the In line each Out line covers
 *   gate_pass_returns.out_gate_pass_id     the Out pass that carried a return
 *
 * The last one is nullable: returns recorded by hand before this existed, and
 * any recorded by hand afterwards, simply have no Out pass behind them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            // Deleting the In pass must not take its Out passes with it — the
            // Out is a document in its own right, already issued and signed.
            $t->foreignId('source_gate_pass_id')->nullable()->after('rfq_id')
                ->constrained('gate_passes')->nullOnDelete();
        });

        Schema::table('gate_pass_items', function (Blueprint $t) {
            $t->foreignId('source_gate_pass_item_id')->nullable()->after('rfq_item_id')
                ->constrained('gate_pass_items')->nullOnDelete();
        });

        Schema::table('gate_pass_returns', function (Blueprint $t) {
            $t->foreignId('out_gate_pass_id')->nullable()->after('gate_pass_item_id')
                ->constrained('gate_passes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('gate_passes', fn (Blueprint $t) => $t->dropConstrainedForeignId('source_gate_pass_id'));
        Schema::table('gate_pass_items', fn (Blueprint $t) => $t->dropConstrainedForeignId('source_gate_pass_item_id'));
        Schema::table('gate_pass_returns', fn (Blueprint $t) => $t->dropConstrainedForeignId('out_gate_pass_id'));
    }
};
