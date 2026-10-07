<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who is doing THIS operation.
 *
 * BITAC: on a job at a shop, the in-charge (or the AE holding it) picks the
 * bench for each operation **and the person responsible for it** — "kon
 * sub-section kaj ta korbe r responsible person ke". The bench was already
 * per-step (`sub_section_id`); the person was not recorded anywhere.
 *
 * ⚠️ This is NOT `work_order_sections.assigned_to`. That is who holds the
 * whole job at the shop (migration 000060, the XEN → AE handover); this is one
 * operation on one item. A job can be held by one AE while three different
 * people are named on its operations, and both facts have to survive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operation_steps', function (Blueprint $table) {
            $table->foreignId('assigned_to')->nullable()->after('sub_section_id')
                ->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_by')->nullable()->after('assigned_to')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable()->after('assigned_by');
        });
    }

    public function down(): void
    {
        Schema::table('operation_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
            $table->dropConstrainedForeignId('assigned_by');
            $table->dropColumn('assigned_at');
        });
    }
};
