<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Legacy column. The current app routes machines via `section_id`; the older
 * `work_centre_id` foreign key is no longer set on create/update. Without a
 * default value, MySQL rejects every INSERT. Make it nullable so the new
 * code path works while existing rows keep their values.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('machines') || ! Schema::hasColumn('machines', 'work_centre_id')) return;

        Schema::table('machines', function (Blueprint $t) {
            // Drop FK first (column rename / change requires it), then re-add as nullable.
            try { $t->dropForeign(['work_centre_id']); } catch (\Throwable $e) {}
        });
        Schema::table('machines', function (Blueprint $t) {
            $t->unsignedBigInteger('work_centre_id')->nullable()->change();
        });
        Schema::table('machines', function (Blueprint $t) {
            try {
                $t->foreign('work_centre_id')->references('id')->on('work_centres')->nullOnDelete();
            } catch (\Throwable $e) {
                // work_centres table may not exist on some installs; safe to skip.
            }
        });
    }

    public function down(): void
    {
        // No-op: don't try to make it non-nullable again — old rows could now have NULL.
    }
};
