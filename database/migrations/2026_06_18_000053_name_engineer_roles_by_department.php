<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;

/**
 * Engineer roles carry their department, because the title alone is ambiguous.
 *
 * BITAC has an Executive Engineer in IED **and** one in PCD. A single
 * `Executive Engineer` role therefore cannot mean anything useful: whoever is
 * put on it gets both departments' access, and nobody can tell by looking
 * which one was intended.
 *
 *   Executive Engineer (IED)   — RFQs, quotations, cost estimates, approvals
 *   Executive Engineer (PCD)   — PCD Inbox: reads an arriving work order and
 *                                 forwards it, or sends it back to IED
 *   Assistant Engineer (PCD)   — Job Planning: job number, MR, routing,
 *                                 operation sheets, release, deliveries
 *
 * ⚠️ The existing `Executive Engineer` role is **IED's** (confirmed by BITAC,
 * 2026-09-30, and by its own permissions — RFQs, quotations, cost estimates,
 * approve/reject, gate passes). It is renamed rather than replaced, so the
 * officer on it keeps everything he had. `review pcd-inbox` is taken off it:
 * an earlier migration granted it there on the assumption that "Executive
 * Engineer" meant PCD's, which was the whole ambiguity this fixes.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── IED's Executive Engineer — renamed, not rebuilt ──────────────
        $ied = Role::where('name', 'Executive Engineer')->first();
        if ($ied) {
            $ied->update(['name' => 'Executive Engineer (IED)']);
            if ($ied->hasPermissionTo('review pcd-inbox')) {
                $ied->revokePermissionTo('review pcd-inbox');
            }
        } else {
            Role::firstOrCreate(['name' => 'Executive Engineer (IED)', 'guard_name' => 'web']);
        }

        // ── PCD's Executive Engineer — the one who reads the inbox ───────
        Role::firstOrCreate(['name' => 'Executive Engineer (PCD)', 'guard_name' => 'web'])
            ->syncPermissions(['view dashboard', 'view work-orders', 'access pcd', 'review pcd-inbox']);

        // ── PCD's Assistant Engineer — the one who plans the job ─────────
        $assistant = Role::where('name', 'Assistant Engineer')->first();
        if ($assistant) {
            $assistant->update(['name' => 'Assistant Engineer (PCD)']);
        } else {
            $source = Role::where('name', 'pcd-officer')->with('permissions')->first();
            $role   = Role::firstOrCreate(['name' => 'Assistant Engineer (PCD)', 'guard_name' => 'web']);
            if ($source) {
                $role->syncPermissions($source->permissions);
            }
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::where('name', 'Executive Engineer (IED)')->first()?->update(['name' => 'Executive Engineer']);
        Role::where('name', 'Assistant Engineer (PCD)')->first()?->update(['name' => 'Assistant Engineer']);

        // Only if nobody is on it — deleting a role someone holds would strip
        // their access with nothing left to say what they had.
        $pcd = Role::where('name', 'Executive Engineer (PCD)')->first();
        if ($pcd && $pcd->users()->count() === 0) {
            $pcd->delete();
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
