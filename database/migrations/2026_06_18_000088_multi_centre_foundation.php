<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Several centres under BITAC Head Office (2026-10-26). The foundation:
 *
 * 1. Permission `view all centres` — who may see every centre and switch
 *    between them (Head Office; the super admin through Gate::before).
 *    ⚠️ Not granted to `super-admin`: Gate::before already lets them past.
 *
 * 2. Every staff member belongs to a centre. ⚠️ On production every one of
 *    the 43 users had NO centre — harmless with one centre, but with a second
 *    a centre-less user saw everything. All of them go to the default centre
 *    (Dhaka), except the super admin, who stays centre-less.
 *
 * 3. Material requisitions get a centre — they had none at all, so every
 *    centre would have seen every centre's MRs. Taken from the job, else the
 *    shop's people, else the default centre.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        DB::table('permissions')->insertOrIgnore([
            'name' => 'view all centres', 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now,
        ]);

        $default = (int) DB::table('centers')->min('id');
        if ($default) {
            $superAdmins = DB::table('model_has_roles')
                ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                ->whereIn('roles.name', ['super-admin', 'super_admin'])
                ->where('model_has_roles.model_type', 'App\\Models\\User')
                ->pluck('model_has_roles.model_id');
            DB::table('users')->whereNull('center_id')->whereNotIn('id', $superAdmins)
                ->update(['center_id' => $default]);
        }

        if (! Schema::hasColumn('material_requisitions', 'center_id')) {
            Schema::table('material_requisitions', function (Blueprint $table) {
                $table->foreignId('center_id')->nullable()->after('id')->constrained('centers')->nullOnDelete();
            });
        }
        DB::table('material_requisitions')->whereNull('center_id')->whereNotNull('work_order_id')
            ->update(['center_id' => DB::raw('(select w.center_id from work_orders w where w.id = material_requisitions.work_order_id)')]);
        if ($default) {
            DB::table('material_requisitions')->whereNull('center_id')->update(['center_id' => $default]);
        }

        // 4. The two roles that come with several centres.
        foreach (self::ROLES as $role => $perms) {
            DB::table('roles')->insertOrIgnore(['name' => $role, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now]);
            $roleId = DB::table('roles')->where('name', $role)->where('guard_name', 'web')->value('id');
            foreach ($perms as $p) {
                DB::table('permissions')->insertOrIgnore(['name' => $p, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now]);
                $pid = DB::table('permissions')->where('name', $p)->where('guard_name', 'web')->value('id');
                DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $pid, 'role_id' => $roleId]);
            }
        }

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * ⚠️ **Head Office READS.** It monitors every centre — dashboards, reports,
     * jobs, bills, receivables — and holds no create / edit / approve
     * permission and no department permission (`view rfqs`, `view pcd-inbox`,
     * …), which would also put it on those departments' notification fan-outs
     * at every centre. The centres do the work.
     *
     * **Centre Admin** manages one centre's staff (Admin → Users, approval
     * chains, gate-pass approvers — all centre-scoped). ⚠️ Deliberately NOT
     * `manage roles`: whoever edits roles can give their own role anything.
     * Admin\UserController refuses to let them grant or touch a privileged
     * role (User::PRIVILEGED_PERMISSIONS).
     */
    public const ROLES = [
        'Head Office' => [
            'view all centres', 'view dashboard', 'view live dashboard', 'view reports', 'export reports',
            'view qc-reports', 'view work-orders', 'view invoices', 'view payments', 'view delivery',
            'view completion-certificates', 'use notes',
        ],
        'Centre Admin' => [
            'view dashboard', 'manage users', 'manage customers', 'view audit-log', 'use notes',
        ],
    ];

    public function down(): void
    {
        if (Schema::hasColumn('material_requisitions', 'center_id')) {
            Schema::table('material_requisitions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('center_id');
            });
        }
        // ⚠️ A role somebody is on is kept — rolling back must not quietly
        // strip real people of their access.
        foreach (array_keys(self::ROLES) as $role) {
            $id = DB::table('roles')->where('name', $role)->value('id');
            if ($id && ! DB::table('model_has_roles')->where('role_id', $id)->exists()) {
                DB::table('roles')->where('id', $id)->delete();
            }
        }
        if (! DB::table('roles')->where('name', 'Head Office')->exists()) {
            DB::table('permissions')->where('name', 'view all centres')->delete();
        }
        // Users keep the centre they were given — un-setting it would widen
        // what they can see.
    }
};
