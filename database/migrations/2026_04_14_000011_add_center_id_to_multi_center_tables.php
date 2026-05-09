<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-center architecture: add center_id to tables that were missing it.
 *
 * Direct center scoping (own center_id column):
 * - meetings, file_folders, cost_estimates, rfq_items
 *
 * Transitive scoping (scoped through parent) — NOT modified:
 * - meeting_participants, meeting_messages, meeting_action_items,
 *   meeting_decisions, rfq_item_files (all accessed via their parent)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── meetings ──
        Schema::table('meetings', function (Blueprint $table) {
            $table->foreignId('center_id')->nullable()->after('host_user_id')
                ->constrained('centers')->nullOnDelete();
            $table->index('center_id');
        });
        // Backfill from host user's center
        DB::statement("
            UPDATE meetings m
            INNER JOIN users u ON u.id = m.host_user_id
            SET m.center_id = u.center_id
            WHERE m.center_id IS NULL AND u.center_id IS NOT NULL
        ");

        // ── file_folders ──
        Schema::table('file_folders', function (Blueprint $table) {
            $table->foreignId('center_id')->nullable()->after('user_id')
                ->constrained('centers')->nullOnDelete();
            $table->index('center_id');
        });
        DB::statement("
            UPDATE file_folders f
            INNER JOIN users u ON u.id = f.user_id
            SET f.center_id = u.center_id
            WHERE f.center_id IS NULL AND u.center_id IS NOT NULL
        ");

        // ── cost_estimates ──
        if (!Schema::hasColumn('cost_estimates', 'center_id')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->foreignId('center_id')->nullable()->after('rfq_id')
                    ->constrained('centers')->nullOnDelete();
                $table->index('center_id');
            });
        }
        // Backfill from linked RFQ's center, fallback to creator's center
        DB::statement("
            UPDATE cost_estimates ce
            INNER JOIN rfqs r ON r.id = ce.rfq_id
            SET ce.center_id = r.center_id
            WHERE ce.center_id IS NULL AND r.center_id IS NOT NULL
        ");
        DB::statement("
            UPDATE cost_estimates ce
            INNER JOIN users u ON u.id = ce.created_by
            SET ce.center_id = u.center_id
            WHERE ce.center_id IS NULL AND u.center_id IS NOT NULL
        ");

        // ── rfq_items ──
        if (!Schema::hasColumn('rfq_items', 'center_id')) {
            Schema::table('rfq_items', function (Blueprint $table) {
                $table->foreignId('center_id')->nullable()->after('rfq_id')
                    ->constrained('centers')->nullOnDelete();
                $table->index('center_id');
            });
        }
        DB::statement("
            UPDATE rfq_items ri
            INNER JOIN rfqs r ON r.id = ri.rfq_id
            SET ri.center_id = r.center_id
            WHERE ri.center_id IS NULL AND r.center_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropForeign(['center_id']);
            $table->dropColumn('center_id');
        });
        Schema::table('file_folders', function (Blueprint $table) {
            $table->dropForeign(['center_id']);
            $table->dropColumn('center_id');
        });
        if (Schema::hasColumn('cost_estimates', 'center_id')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->dropForeign(['center_id']);
                $table->dropColumn('center_id');
            });
        }
        if (Schema::hasColumn('rfq_items', 'center_id')) {
            Schema::table('rfq_items', function (Blueprint $table) {
                $table->dropForeign(['center_id']);
                $table->dropColumn('center_id');
            });
        }
    }
};
