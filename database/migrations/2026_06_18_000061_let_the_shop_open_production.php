<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * The shop's people need to be able to open the production module.
 *
 * ⚠️ **Every `/production/*` route sits behind `permission:view production`**
 * — the queue, a job's page, forward, receive, transfer, logging output, all
 * of it. `shop-incharge` did not hold it, so migration 000060 made the
 * নির্বাহী প্রকৌশলী the XEN of his shop while leaving him unable to open the
 * screen where that means anything. Only `super-admin` and `section_supervisor`
 * held it, and `section_supervisor` was meant for a sub-section's supervisor.
 *
 * So:
 *  - the shop in-charge (the XEN) gets `view production`, and
 *    `submit maintenance-requests` because the job page offers that button;
 *  - his assistant engineers get a role of their own rather than borrowing
 *    `section_supervisor`, whose name says bench, not shop.
 *
 * ⚠️ **`Assistant Engineer (Shop)` deliberately does NOT hold
 * `assign shop-jobs`** — that permission is the whole definition of who the
 * XEN is (see App\Services\ShopAssignment). Granting it here would make every
 * assistant a XEN and the forward/receive flow would quietly do nothing.
 */
return new class extends Migration
{
    private const ASSISTANT_ROLE = 'Assistant Engineer (Shop)';

    private const ASSISTANT_PERMISSIONS = [
        'view dashboard',
        'view production',
        'view work-orders',
        'submit maintenance-requests',
    ];

    public function up(): void
    {
        // The shop in-charge can finally open the module he supervises.
        if ($shop = Role::where('name', 'shop-incharge')->first()) {
            foreach (['view production', 'submit maintenance-requests'] as $name) {
                if (Permission::where('name', $name)->where('guard_name', 'web')->exists()) {
                    $shop->givePermissionTo($name);
                }
            }
        }

        $assistant = Role::firstOrCreate(['name' => self::ASSISTANT_ROLE, 'guard_name' => 'web']);

        // givePermissionTo rather than syncPermissions: on a re-run this must
        // not strip anything an admin has added to the role by hand.
        foreach (self::ASSISTANT_PERMISSIONS as $name) {
            if (Permission::where('name', $name)->where('guard_name', 'web')->exists()) {
                $assistant->givePermissionTo($name);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        if ($shop = Role::where('name', 'shop-incharge')->first()) {
            foreach (['view production', 'submit maintenance-requests'] as $name) {
                $shop->revokePermissionTo($name);
            }
        }

        // ⚠️ The role is only removed if nobody is on it — rolling a migration
        // back must not quietly unassign real people from their job.
        $assistant = Role::where('name', self::ASSISTANT_ROLE)->first();
        if ($assistant && $assistant->users()->count() === 0) {
            $assistant->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
