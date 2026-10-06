<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Seeds the BITAC department-aligned roles that match the actual workflow:
 * IED → PCD → Shops → QC
 *
 * These roles supplement the legacy generic roles and are used for the
 * department-scoped inboxes and dashboards introduced in Phase 0+.
 */
class BitacDepartmentRolesSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── New permissions for the department workflow ────────────
        $newPermissions = [
            // IED (Industrial Engineering)
            'access ied',
            'create cost-estimates', 'view cost-estimates', 'edit cost-estimates',
            'manage materials-master', 'manage operations-master',
            'submit quotation-to-customer',
            'create quotation-revision',

            // PCD (Production Control)
            'access pcd',
            'view pcd-inbox',
            'create material-requisitions', 'approve material-requisitions',
            'assign sections', 'assign machines-operators',
            'release-job-to-shops',

            // Shop in-charge (per shop)
            'access shops',
            'view shop-inbox',
            'override machine-assignment', 'override operator-assignment',
            'mark shop-operation-complete',

            // QC
            'access qc',
            'manage inspection-plans',
            'record dimensional-measurements',
            'manage defect-categories',

            // Sections / Operators master
            'manage sections', 'manage operators', 'manage machines',
        ];

        foreach ($newPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        // ── New department roles ────────────────────────────────────

        // IED Officer — handles RFQ → Quotation → IED→PCD handoff
        $ied = Role::firstOrCreate(['name' => 'ied-officer']);
        $iedPermissions = [
            'view dashboard',
            'view rfqs', 'create rfqs', 'edit rfqs',
            'view quotations', 'create quotations', 'edit quotations',
            'submit quotation-to-customer', 'create quotation-revision',
            'access ied',
            'view cost-estimates', 'create cost-estimates', 'edit cost-estimates',
            // The yearly target per centre is set from IED → Reports.
            'set targets',
        ];
        $ied->syncPermissions($iedPermissions);

        // PCD Officer — the generic name for the planning job. BITAC's own
        // staff are assigned the designation roles below; this stays as the
        // canonical definition of what the job can do.
        $pcd = Role::firstOrCreate(['name' => 'pcd-officer']);
        $pcdPermissions = [
            'view dashboard',
            'view work-orders',
            'access pcd', 'view pcd-inbox',
            'view mrp', 'run mrp', 'create requisitions', 'create material-requisitions',
            'assign sections', 'assign machines-operators',
            'view operation-sheets', 'create operation-sheets',
            'release-job-to-shops',
            'view schedule', 'manage schedule',
            // Delivery Orders moved from Delivery & Billing to PCD — the
            // department that ran the job also ships it.
            'view delivery', 'create delivery', 'complete delivery',
        ];
        $pcd->syncPermissions($pcdPermissions);

        /*
         * BITAC's own designations. ⚠️ **The department is part of the name**:
         * there is an Executive Engineer in IED *and* one in PCD, so the title
         * alone says nothing about what the role should be able to do.
         *
         *   Executive Engineer (IED)  — RFQs, quotations, cost estimates,
         *                               approvals.
         *   Executive Engineer (PCD)  → PCD Inbox. Reads a work order as it
         *                               arrives from IED and forwards it on,
         *                               or sends it back.
         *   Assistant Engineer (PCD)  → Job Planning. Job number, material
         *                               requisition, routing, operation
         *                               sheets, release, deliveries.
         *
         * ⚠️ Neither PCD role holds the other's permission. Accepting the work
         * and planning it are two jobs held by two people; giving the planner
         * `review pcd-inbox` would collapse the step back into one.
         */
        Role::firstOrCreate(['name' => 'Executive Engineer (IED)'])
            ->syncPermissions($iedPermissions);

        Role::firstOrCreate(['name' => 'Executive Engineer (PCD)'])
            ->syncPermissions(['view dashboard', 'view work-orders', 'access pcd', 'review pcd-inbox']);

        Role::firstOrCreate(['name' => 'Assistant Engineer (PCD)'])
            ->syncPermissions($pcdPermissions);

        // Shop In-Charge — sees only their shop's jobs
        // Shop In-charge = the shop's নির্বাহী প্রকৌশলী (XEN). `assign shop-jobs`
        // is what makes him one: he forwards a job to an assistant engineer or
        // to a sub-section, and they receive it. See App\Services\ShopAssignment.
        $shop = Role::firstOrCreate(['name' => 'shop-incharge']);
        $shop->syncPermissions([
            'view dashboard',
            'view work-orders',
            'access shops', 'view shop-inbox',
            'override machine-assignment', 'override operator-assignment',
            'mark shop-operation-complete',
            'view shop-floor', 'start jobs', 'stop jobs', 'log downtime',
            'view wip',
            // ⚠️ Every /production/* route is behind `view production` — without
            // it he cannot open the module he supervises, and `assign shop-jobs`
            // means nothing. (Migration 000061 adds it on live databases.)
            'view production',
            'submit maintenance-requests',
            'assign shop-jobs',
        ]);

        // Assistant Engineer under a shop's XEN. Posted to the SHOP (not a
        // sub-section) by `users.section_id`; he receives the jobs forwarded to
        // him, assigns the sub-sections and logs the output.
        //
        // ⚠️ He must NOT hold `assign shop-jobs` — that permission IS the
        // definition of the XEN, so granting it would make every assistant a
        // XEN and the forward/receive flow would quietly do nothing.
        //
        // ⚠️ AE and SAE are the SAME THING to the system (BITAC, 2026-10-06):
        // there is no third layer. Whoever holds a job may pass it on, so an AE
        // hands it to his SAE with the same action the XEN used. The two roles
        // exist only so the admin can assign by the designation a person
        // actually holds; their permission sets are identical.
        $shopEngineer = [
            'view dashboard',
            'view production',
            'view work-orders',
            'submit maintenance-requests',
        ];
        Role::firstOrCreate(['name' => 'Assistant Engineer (Shop)'])->syncPermissions($shopEngineer);
        Role::firstOrCreate(['name' => 'Sub-Assistant Engineer (Shop)'])->syncPermissions($shopEngineer);

        // QC Officer
        $qc = Role::firstOrCreate(['name' => 'qc-officer']);
        $qc->syncPermissions([
            'view dashboard',
            'view work-orders',
            'access qc',
            'view qc', 'create qc-inspections', 'create ncrs', 'view qc-reports',
            'manage inspection-plans', 'record dimensional-measurements',
            'manage defect-categories',
        ]);

        // Master data manager (extends it-admin)
        $itAdmin = Role::firstOrCreate(['name' => 'it-admin']);
        $itAdmin->givePermissionTo([
            'manage sections', 'manage operators', 'manage machines',
            'manage materials-master', 'manage operations-master',
            'manage inspection-plans', 'manage defect-categories',
        ]);

        // super-admin already gets everything via Gate::before
        Role::firstOrCreate(['name' => 'super-admin']);
    }
}
