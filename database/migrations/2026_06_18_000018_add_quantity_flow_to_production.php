<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 of the Production extension — quantity-based WIP.
 *
 * An operation_step becomes the "leg" of production: it can be assigned to a
 * sub-section, carries a target quantity, and accumulates a completed quantity
 * fed by daily production_logs. This moves production from all-or-nothing step
 * status to partial, quantity-tracked progress.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operation_steps', function (Blueprint $table) {
            // Which sub-section actually runs this step (null = the parent shop
            // itself, for shops with no sub-sections). Assigned by PCD on the
            // op-sheet, or by the shop when the job arrives.
            $table->foreignId('sub_section_id')->nullable()->after('section_id')
                ->constrained('sections')->nullOnDelete();
            // How many pieces this step must produce (defaults to the item qty).
            $table->decimal('target_qty', 12, 2)->nullable()->after('weight_pct');
            // Running total produced — denormalised from production_logs for fast
            // progress queries; kept in sync on every log create/delete.
            $table->decimal('completed_qty', 12, 2)->default(0)->after('target_qty');
        });

        Schema::create('production_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_step_id')->constrained()->cascadeOnDelete();
            // Denormalised for itemwise reporting without joins.
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('work_order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sub_section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->foreignId('machine_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('operator_id')->nullable()->constrained()->nullOnDelete();
            $table->date('log_date');
            $table->decimal('qty', 12, 2);           // pieces produced this entry
            $table->decimal('hours', 8, 2)->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('logged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['operation_step_id', 'log_date']);
            $table->index(['work_order_id', 'log_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_logs');
        Schema::table('operation_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sub_section_id');
            $table->dropColumn(['target_qty', 'completed_qty']);
        });
    }
};
