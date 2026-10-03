<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Releasing a job to the shops now needs the নির্বাহী প্রকৌশলী's approval.
 *
 * BITAC's rule (2026-10-03): the সহকারী প্রকৌশলী prepares the work order and the
 * operation sheets, but the job does **not** reach the shop floor on the
 * strength of that alone. The **Executive Engineer (PCD)** reads what was
 * planned and releases it.
 *
 * So the gate that used to run `pcd_pending → released_to_shops` the instant
 * the third checklist item went green now stops at **`pcd_release_pending`**.
 *
 * ⚠️ `released_to_shops_at` / `released_by` keep their meaning — they are
 * stamped when the job **actually reaches the shops**, which is now the
 * approval. `release_requested_at` records the earlier moment, when planning
 * finished and it went up for approval.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('work_orders', 'release_requested_at')) {
                $table->timestamp('release_requested_at')->nullable()->after('pcd_review_note');
            }
        });

        // `status` is varchar(30); `pcd_release_pending` needs no widening.
    }

    public function down(): void
    {
        // Anything waiting on approval goes back to the planning desk, or it
        // would sit in a status nothing reads any more.
        \Illuminate\Support\Facades\DB::table('work_orders')
            ->where('status', 'pcd_release_pending')
            ->update(['status' => 'pcd_pending']);

        Schema::table('work_orders', function (Blueprint $table) {
            if (Schema::hasColumn('work_orders', 'release_requested_at')) {
                $table->dropColumn('release_requested_at');
            }
        });
    }
};
