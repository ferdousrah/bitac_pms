<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * From BITAC's 2026-10-10 job run-through:
 *
 * - **PCD's Executive Engineer had no way to the Delivery Orders** — he signs
 *   every challan, but did not hold `view delivery`, so the menu never showed.
 *   He gets it (read only: raising and confirming a delivery now need
 *   `create delivery` / `complete delivery`, which the routes check).
 * - **PCD's planners could not open PCD's Gate Passes at all** — the screen sits
 *   behind `view pcd`, which only the super admin (and, since 000089, the
 *   Executive Engineer) held. They clear a job's Gate Pass In before delivery,
 *   so `pcd-officer` and `Assistant Engineer (PCD)` get it.
 *
 * Grants only — nothing an admin added by hand is taken away.
 */
return new class extends Migration
{
    private const GRANTS = [
        'Executive Engineer (PCD)' => ['view delivery'],
        'pcd-officer'              => ['view pcd'],
        'Assistant Engineer (PCD)' => ['view pcd'],
    ];

    public function up(): void
    {
        foreach (self::GRANTS as $role => $perms) {
            $roleId = DB::table('roles')->where('name', $role)->where('guard_name', 'web')->value('id');
            if (! $roleId) continue;
            foreach ($perms as $perm) {
                $permId = DB::table('permissions')->where('name', $perm)->where('guard_name', 'web')->value('id')
                    ?? DB::table('permissions')->insertGetId(['name' => $perm, 'guard_name' => 'web', 'created_at' => now(), 'updated_at' => now()]);
                DB::table('role_has_permissions')->insertOrIgnore(['permission_id' => $permId, 'role_id' => $roleId]);
            }
        }
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        foreach (self::GRANTS as $role => $perms) {
            $roleId = DB::table('roles')->where('name', $role)->where('guard_name', 'web')->value('id');
            $permIds = DB::table('permissions')->whereIn('name', $perms)->where('guard_name', 'web')->pluck('id');
            if ($roleId) DB::table('role_has_permissions')->where('role_id', $roleId)->whereIn('permission_id', $permIds)->delete();
        }
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
