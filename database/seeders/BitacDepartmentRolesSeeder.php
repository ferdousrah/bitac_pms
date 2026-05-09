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
        $ied->syncPermissions([
            'view dashboard',
            'view rfqs', 'create rfqs', 'edit rfqs',
            'view quotations', 'create quotations', 'edit quotations',
            'submit quotation-to-customer', 'create quotation-revision',
            'access ied',
            'view cost-estimates', 'create cost-estimates', 'edit cost-estimates',
        ]);

        // PCD Officer — receives jobs from IED, handles MR + Section Assign + Op Sheet
        $pcd = Role::firstOrCreate(['name' => 'pcd-officer']);
        $pcd->syncPermissions([
            'view dashboard',
            'view work-orders',
            'access pcd', 'view pcd-inbox',
            'view mrp', 'run mrp', 'create requisitions', 'create material-requisitions',
            'assign sections', 'assign machines-operators',
            'view operation-sheets', 'create operation-sheets',
            'release-job-to-shops',
            'view schedule', 'manage schedule',
        ]);

        // Shop In-Charge — sees only their shop's jobs
        $shop = Role::firstOrCreate(['name' => 'shop-incharge']);
        $shop->syncPermissions([
            'view dashboard',
            'view work-orders',
            'access shops', 'view shop-inbox',
            'override machine-assignment', 'override operator-assignment',
            'mark shop-operation-complete',
            'view shop-floor', 'start jobs', 'stop jobs', 'log downtime',
            'view wip',
        ]);

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
