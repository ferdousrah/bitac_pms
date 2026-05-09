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
        // ── 1. Drop old single-line MRN structure (no real data, replaced with header+items) ─────
        Schema::dropIfExists('material_requisition_notes');

        // ── 2. Material Requisitions (header) — matches the paper MRN format ────────────────────
        Schema::create('material_requisitions', function (Blueprint $table) {
            $table->id();
            $table->string('mrn_number', 30)->unique();              // MRN-2026-0001
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->date('request_date');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();   // PCD officer
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();    // Authorizing Officer
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();      // Stock Keeper
            $table->timestamp('issued_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();    // Material Receiver
            $table->timestamp('received_at')->nullable();
            $table->enum('status', ['draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'received', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['work_order_id', 'status']);
        });

        // ── 3. Material Requisition Items (line items per the paper format) ────────────────────
        Schema::create('material_requisition_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_requisition_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('item_no');                  // 01, 02, 03 ...
            $table->string('description', 255);                       // free text + size info
            $table->foreignId('material_id')->nullable()->constrained()->nullOnDelete();
            $table->string('unit', 20)->default('pcs');
            $table->decimal('required_qty', 12, 3);
            $table->decimal('stock_qty',   12, 3)->nullable();        // from IMS stock check
            $table->decimal('issue_qty',   12, 3)->nullable();        // actually issued
            $table->decimal('pending_qty', 12, 3)->nullable();        // shortage
            $table->date('issue_date')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index('material_requisition_id', 'mri_req_id_idx');
        });

        // ── 4. Work Order Sections — sequential shop assignment ────────────────────────────────
        Schema::create('work_order_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('section_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence');                 // 1, 2, 3 ...
            $table->enum('status', ['pending', 'ready', 'in_progress', 'completed', 'skipped'])->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['work_order_id', 'section_id']);
            $table->index(['work_order_id', 'sequence']);
            $table->index(['section_id', 'status']);
        });

        // ── 5. Extend operation_steps with section + operator + status ────────────────────────
        Schema::table('operation_steps', function (Blueprint $table) {
            $table->foreignId('section_id')->nullable()->after('operation_sheet_id')->constrained()->nullOnDelete();
            $table->foreignId('operator_id')->nullable()->after('machine_id')->constrained()->nullOnDelete();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'skipped'])->default('pending')->after('estimated_hours');
            $table->decimal('actual_hours', 8, 2)->nullable()->after('status');
            $table->timestamp('started_at')->nullable()->after('actual_hours');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->foreignId('operation_id')->nullable()->after('operation_name')->constrained('machining_operations')->nullOnDelete();
        });

        // ── 6. Track PCD release on work_orders ───────────────────────────────────────────────
        Schema::table('work_orders', function (Blueprint $table) {
            $table->timestamp('released_to_shops_at')->nullable()->after('pcd_handoff_by');
            $table->foreignId('released_by')->nullable()->after('released_to_shops_at')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['released_by']);
            $table->dropColumn(['released_to_shops_at', 'released_by']);
        });

        Schema::table('operation_steps', function (Blueprint $table) {
            $table->dropForeign(['section_id']);
            $table->dropForeign(['operator_id']);
            $table->dropForeign(['operation_id']);
            $table->dropColumn(['section_id', 'operator_id', 'status', 'actual_hours', 'started_at', 'completed_at', 'operation_id']);
        });

        Schema::dropIfExists('work_order_sections');
        Schema::dropIfExists('material_requisition_items');
        Schema::dropIfExists('material_requisitions');
    }
};
