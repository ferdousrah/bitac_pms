<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;

/**
 * সহকারী প্রকৌশলী — the Assistant Engineer does the Job Planning work.
 *
 * BITAC's split (2026-09-30), and the reason the PCD step was divided in two:
 *
 *   • **নির্বাহী প্রকৌশলী** (Executive Engineer) → **PCD Inbox**. Reads a work
 *     order as it arrives and forwards it on, or sends it back to IED.
 *   • **সহকারী প্রকৌশলী** (Assistant Engineer) → **Job Planning**. Job number,
 *     material requisition, section routing, operation sheets, release to the
 *     shops, and the delivery orders that follow.
 *
 * ⚠️ The Assistant Engineer deliberately does **not** get `review pcd-inbox`.
 * Accepting the work and planning it are two jobs held by two people — giving
 * the planner the review permission would collapse the step back into one.
 *
 * The permission set is `pcd-officer`'s, which is the seeded definition of the
 * PCD job. That role stays as it is; this is BITAC's own designation for the
 * same work, and it is the one their staff are actually assigned to.
 */
return new class extends Migration
{
    private const SOURCE_ROLE = 'pcd-officer';
    private const NEW_ROLE    = 'Assistant Engineer';

    public function up(): void
    {
        $source = Role::where('name', self::SOURCE_ROLE)->with('permissions')->first();
        if (! $source) {
            return;   // a database seeded differently — nothing to mirror
        }

        $role = Role::firstOrCreate(['name' => self::NEW_ROLE, 'guard_name' => 'web']);

        // syncPermissions, not give: re-running must leave exactly this set.
        $role->syncPermissions($source->permissions);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Only if nobody is on it — deleting a role someone holds would strip
        // their access with no way to tell what they had.
        $role = Role::where('name', self::NEW_ROLE)->first();
        if ($role && $role->users()->count() === 0) {
            $role->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
