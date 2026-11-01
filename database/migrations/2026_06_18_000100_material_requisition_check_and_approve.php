<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A PCD material requisition is Prepared by whoever raises it, Checked by the
 * Assistant Engineer (PCD) and Approved by the Executive Engineer (PCD)
 * (BITAC, 2026-11-01). Each step's signature is stored as a PATH, like every
 * signed document here.
 *
 * `status` is already varchar(30), so the new `checked` step needs no widening.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requisitions', function (Blueprint $table) {
            $table->string('prepared_signature_path')->nullable()->after('requested_by');
            $table->foreignId('checked_by')->nullable()->after('prepared_signature_path')->constrained('users')->nullOnDelete();
            $table->timestamp('checked_at')->nullable()->after('checked_by');
            $table->string('checked_signature_path')->nullable()->after('checked_at');
            $table->string('approved_signature_path')->nullable()->after('approved_at');
        });
    }

    public function down(): void
    {
        Schema::table('material_requisitions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('checked_by');
            $table->dropColumn(['prepared_signature_path', 'checked_at', 'checked_signature_path', 'approved_signature_path']);
        });
    }
};
