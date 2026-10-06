<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * উপ-সহকারী প্রকৌশলী at a shop.
 *
 * ⚠️ **AE and SAE are the same thing to the system**, and deliberately so
 * (BITAC, 2026-10-06). There is no third layer: a job reaches the shop's
 * নির্বাহী প্রকৌশলী, who passes it to an AE (or sends it straight to a
 * sub-section); the AE assigns the sub-section and logs the output, or passes
 * it to his SAE to do either. The rule is simply **whoever holds a job may
 * pass it on** — see ShopAssignment::canForward().
 *
 * So this role carries exactly what `Assistant Engineer (Shop)` carries. It
 * exists only so the admin can assign by the designation a person actually
 * holds, the same way `Executive Engineer (PCD)` and `Assistant Engineer (PCD)`
 * read on the Users screen.
 *
 * ⚠️ Like the AE role it must NOT hold `assign shop-jobs` — that permission IS
 * the definition of the XEN, so granting it would make every SAE a XEN and the
 * handover would quietly do nothing.
 */
return new class extends Migration
{
    private const ROLE = 'Sub-Assistant Engineer (Shop)';

    /** Identical to `Assistant Engineer (Shop)` — that is the point. */
    private const PERMISSIONS = [
        'view dashboard',
        'view production',
        'view work-orders',
        'submit maintenance-requests',
    ];

    public function up(): void
    {
        $role = Role::firstOrCreate(['name' => self::ROLE, 'guard_name' => 'web']);

        // givePermissionTo, not sync: a re-run must not strip anything an admin
        // has added to the role by hand.
        foreach (self::PERMISSIONS as $name) {
            if (Permission::where('name', $name)->where('guard_name', 'web')->exists()) {
                $role->givePermissionTo($name);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // ⚠️ Only if nobody is on it — a rollback must not quietly unassign
        // real people from their job.
        $role = Role::where('name', self::ROLE)->first();
        if ($role && $role->users()->count() === 0) {
            $role->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
