<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * A work order now stops with the PCD boss before it reaches planning.
 *
 * BITAC's flow (2026-09-30): IED forwards → **নির্বাহী প্রকৌশলী** sees a new work
 * order has arrived, reads it, and forwards it on (or sends it back to IED) →
 * only then does it reach the desk where the job number, material requisition,
 * routing and operation sheets are prepared.
 *
 * ⚠️ **`pcd_pending` keeps its meaning** — "on the planning desk". The new stop
 * is a new status **before** it, so every work order already in flight stays
 * exactly where it is and nothing has to be re-forwarded by hand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            // `pcd_handoff_at/by` stays IED's stamp — when it reached PCD at
            // all. These record the second act: the boss passing it on.
            if (! Schema::hasColumn('work_orders', 'pcd_forwarded_at')) {
                $table->timestamp('pcd_forwarded_at')->nullable()->after('pcd_handoff_by');
            }
            if (! Schema::hasColumn('work_orders', 'pcd_forwarded_by')) {
                $table->foreignId('pcd_forwarded_by')->nullable()->after('pcd_forwarded_at')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('work_orders', 'pcd_review_note')) {
                $table->text('pcd_review_note')->nullable()->after('pcd_forwarded_by');
            }
        });

        // `status` is varchar(30), so `pcd_review` needs no widening.

        $permission = Permission::firstOrCreate(
            ['name' => 'review pcd-inbox', 'guard_name' => 'web'],
        );

        // নির্বাহী প্রকৌশলী is the Executive Engineer role. A super admin gets it
        // too, or the only people who could unblock the queue would be the ones
        // who cannot see it.
        foreach (['Executive Engineer', 'super-admin', 'super_admin'] as $roleName) {
            Role::where('name', $roleName)->first()?->givePermissionTo($permission);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Anything still waiting on the boss goes to the planning desk, or it
        // would be stranded in a status nothing reads any more.
        \Illuminate\Support\Facades\DB::table('work_orders')
            ->where('status', 'pcd_review')
            ->update(['status' => 'pcd_pending']);

        if (Schema::hasColumn('work_orders', 'pcd_forwarded_by')) {
            Schema::table('work_orders', fn (Blueprint $t) => $t->dropForeign(['pcd_forwarded_by']));
        }

        Schema::table('work_orders', function (Blueprint $table) {
            foreach (['pcd_forwarded_at', 'pcd_forwarded_by', 'pcd_review_note'] as $column) {
                if (Schema::hasColumn('work_orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Permission::where('name', 'review pcd-inbox')->delete();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
