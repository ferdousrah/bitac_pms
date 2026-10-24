<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PCD completes a job once it is fully delivered, with production photos
 * (BITAC, 2026-10-24). The status stays `delivered` — dozens of places treat
 * that as the end of a job — and completion is a stamp on top of it.
 *
 * The photos themselves are `work_order_files` rows of kind
 * `production_photo`; that table already takes any kind, so no change there.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('work_orders', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('cancellation_reason');
                $table->foreignId('completed_by')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
                $table->text('completion_note')->nullable()->after('completed_by');
            }
        });

        // ⚠️ Jobs delivered before this rule could never be completed — they
        // have no production photos and the goods are gone — so they would sit
        // in PCD's "To Complete" list for ever. The rule applies from now on:
        // they are stamped completed as of their last update, by nobody, and
        // say why. Raw DB, so no notification fires on deploy.
        DB::table('work_orders')->where('status', 'delivered')->whereNull('completed_at')
            ->update([
                'completed_at'    => DB::raw('updated_at'),
                'completion_note' => 'Delivered before production photos were required — completed automatically.',
            ]);
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (Schema::hasColumn('work_orders', 'completed_at')) {
                $table->dropForeign(['completed_by']);
                $table->dropColumn(['completed_at', 'completed_by', 'completion_note']);
            }
        });
    }
};
