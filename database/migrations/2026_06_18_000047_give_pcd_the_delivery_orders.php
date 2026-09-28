<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Delivery Orders moved from Delivery & Billing to PCD (BITAC, 2026-09-28) —
 * the department that planned and ran the job also ships it. Billing & Accounts
 * keeps the money: bills/invoices and মূসক ৬.৩.
 *
 * The seeder change alone only helps a fresh install, so grant it here too —
 * otherwise the menu appears for nobody on a database that is already live.
 */
return new class extends Migration
{
    private const GRANTS = ['view delivery', 'create delivery', 'complete delivery'];

    public function up(): void
    {
        $role = Role::where('name', 'pcd-officer')->first();
        if (! $role) {
            return;
        }

        foreach (self::GRANTS as $name) {
            $permission = Permission::where('name', $name)->first();
            if ($permission && ! $role->hasPermissionTo($permission)) {
                $role->givePermissionTo($permission);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        $role = Role::where('name', 'pcd-officer')->first();
        if (! $role) {
            return;
        }

        foreach (self::GRANTS as $name) {
            if (Permission::where('name', $name)->exists()) {
                $role->revokePermissionTo($name);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
