<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Production module schema.
 *
 *  - users.section_id : which production section the user supervises
 *  - section_handoffs : full audit log of every forward / backward transition
 *  - section_handoff_files : attachments (defect photos, inspection notes, etc.) per handoff
 *
 * Adds the new WorkOrderSection statuses 'rework' and 'awaiting_rework' implicitly
 * by widening the column from ENUM to varchar(20) so the application controls the
 * allowed values.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('section_id')->nullable()->after('center_id')
                  ->constrained('sections')->nullOnDelete();
        });

        // Widen WOS.status so new states (rework, awaiting_rework) fit
        DB::statement("ALTER TABLE work_order_sections MODIFY status VARCHAR(20) NOT NULL DEFAULT 'pending'");

        Schema::create('section_handoffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->foreignId('to_section_id')->constrained('sections')->cascadeOnDelete();
            $table->enum('direction', ['forward', 'backward', 'rework_return']);
            $table->text('note')->nullable();
            $table->foreignId('rework_for_id')->nullable()->constrained('section_handoffs')->nullOnDelete()
                  ->comment('Set on rework_return handoffs to link them to the original backward handoff.');
            $table->foreignId('transferred_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('transferred_at')->useCurrent();
            $table->timestamps();

            $table->index(['work_order_id', 'transferred_at']);
            $table->index(['to_section_id', 'direction']);
        });

        Schema::create('section_handoff_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_handoff_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('stored_path');
            $table->string('original_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamps();

            $table->index('section_handoff_id', 'shf_handoff_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('section_handoff_files');
        Schema::dropIfExists('section_handoffs');

        DB::statement("ALTER TABLE work_order_sections MODIFY status ENUM('pending','ready','in_progress','completed','skipped') NOT NULL DEFAULT 'pending'");

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('section_id');
        });
    }
};
