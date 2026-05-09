<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Change management for cost estimates and quotations.
 * Polymorphic revisions table - one entry per significant change event.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_revisions', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 60);                 // 'cost_estimate' or 'quotation'
            $table->unsignedBigInteger('entity_id');
            $table->unsignedInteger('revision_no');            // 1, 2, 3...
            $table->enum('event', [
                'created', 'updated',
                'submitted_for_approval',
                'approved', 'rejected',
                'changes_requested',
                'resubmitted',
                'used_as_quotation',
                'converted_to_workorder',
                'sent_to_customer',
                'customer_accepted', 'customer_rejected',
                'other',
            ]);
            $table->json('snapshot');                          // full state at this point
            $table->json('changes')->nullable();               // {field: {old, new}, ...} — diff vs previous
            $table->decimal('grand_total_at', 14, 2)->nullable(); // for quick total comparison
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('change_reason')->nullable();         // user-provided reason
            $table->text('auto_summary')->nullable();          // "Material cost +5%, added 2 lines"
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id', 'revision_no']);
            $table->index('changed_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_revisions');
    }
};
