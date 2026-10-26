<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gate-pass approvers belong to a DESK (BITAC, 2026-10-27): a pass IED issues
 * is approved by IED's নির্বাহী প্রকৌশলী, one PCD issues by PCD's.
 *
 * Every existing approver was approving PCD passes (IED passes issued
 * directly), so they keep doing exactly that — `desk = 'pcd'`. Moving one to
 * IED is an admin act on the screen.
 *
 * ⚠️ The unique becomes (user_id, center_id, desk) — one person can approve
 * for both desks. `user_id` stays LEFTMOST so the new index can carry
 * `gate_pass_approvers_user_id_foreign`; it is created BEFORE the old one is
 * dropped, or MySQL refuses (the trap migration 000040 hit).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('gate_pass_approvers', 'desk')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->string('desk', 10)->default('pcd')->after('center_id');
            });
        }
        DB::table('gate_pass_approvers')->whereNull('desk')->update(['desk' => 'pcd']);

        if (! $this->hasIndex('gp_approvers_user_centre_desk_unique')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->unique(['user_id', 'center_id', 'desk'], 'gp_approvers_user_centre_desk_unique');
            });
        }
        if ($this->hasIndex('gate_pass_approvers_user_id_center_id_unique')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->dropUnique('gate_pass_approvers_user_id_center_id_unique');
            });
        }
        // PCD's নির্বাহী প্রকৌশলী approves PCD's passes, so he must be able to
        // open them: every PCD gate pass page sits behind `view pcd`. Added,
        // never synced — nothing an admin granted by hand is taken away.
        $perm = DB::table('permissions')->where('name', 'view pcd')->where('guard_name', 'web')->value('id');
        $role = DB::table('roles')->where('name', 'Executive Engineer (PCD)')->where('guard_name', 'web')->value('id');
        if ($perm && $role) {
            DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $perm, 'role_id' => $role]);
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        // Back to one pool: an IED approver who is also a PCD approver would
        // collide on (user_id, center_id), so IED rows go.
        DB::table('gate_pass_approvers')->where('desk', 'ied')->delete();

        if (! $this->hasIndex('gate_pass_approvers_user_id_center_id_unique')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->unique(['user_id', 'center_id'], 'gate_pass_approvers_user_id_center_id_unique');
            });
        }
        if ($this->hasIndex('gp_approvers_user_centre_desk_unique')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->dropUnique('gp_approvers_user_centre_desk_unique');
            });
        }
        if (Schema::hasColumn('gate_pass_approvers', 'desk')) {
            Schema::table('gate_pass_approvers', function (Blueprint $t) {
                $t->dropColumn('desk');
            });
        }
    }

    private function hasIndex(string $name): bool
    {
        return collect(DB::select('SHOW INDEX FROM gate_pass_approvers'))->contains('Key_name', $name);
    }
};
