<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Dashboard
            'view dashboard', 'view live dashboard',
            // RFQ
            'view rfqs', 'create rfqs', 'edit rfqs', 'delete rfqs',
            // Quotations
            'view quotations', 'create quotations', 'edit quotations',
            'approve quotations', 'reject quotations', 'convert quotations',
            // Work Orders
            'view work-orders', 'create work-orders', 'edit work-orders', 'approve work-orders',
            // MRP
            'view mrp', 'run mrp', 'create requisitions',
            // Operation Sheets
            'view operation-sheets', 'create operation-sheets', 'approve operation-sheets',
            // Scheduling
            'view schedule', 'manage schedule',
            // Shop Floor
            'view shop-floor', 'start jobs', 'stop jobs', 'log downtime',
            // WIP
            'view wip',
            // QC
            'view qc', 'create qc-inspections', 'create ncrs', 'view qc-reports',
            // Delivery
            'view delivery', 'create delivery', 'complete delivery',
            // Invoices
            'view invoices', 'create invoices', 'download invoices',
            // Reports
            'view reports', 'export reports',
            // Admin
            'manage users', 'manage roles', 'manage customers', 'view audit-log',
            // Customer
            'view customer-portal',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // 1. super-admin — all permissions via Gate::before
        $superAdmin = Role::firstOrCreate(['name' => 'super-admin']);

        // 2. management
        $management = Role::firstOrCreate(['name' => 'management']);
        $management->syncPermissions([
            'view dashboard', 'view live dashboard',
            'view rfqs', 'view quotations', 'approve quotations', 'reject quotations', 'convert quotations',
            'view work-orders', 'approve work-orders',
            'view mrp', 'view operation-sheets', 'view schedule',
            'view wip', 'view qc', 'view qc-reports',
            'view delivery', 'view invoices',
            'view reports', 'export reports',
        ]);

        // 3. production-supervisor
        $supervisor = Role::firstOrCreate(['name' => 'production-supervisor']);
        $supervisor->syncPermissions([
            'view dashboard', 'view live dashboard',
            'view work-orders', 'view operation-sheets', 'approve operation-sheets',
            'view schedule', 'manage schedule',
            'view wip', 'view shop-floor',
            'view qc', 'view reports',
        ]);

        // 4. machine-operator
        $operator = Role::firstOrCreate(['name' => 'machine-operator']);
        $operator->syncPermissions([
            'view shop-floor', 'start jobs', 'stop jobs', 'log downtime',
        ]);

        // 5. qc-inspector
        $qcInspector = Role::firstOrCreate(['name' => 'qc-inspector']);
        $qcInspector->syncPermissions([
            'view dashboard', 'view qc', 'create qc-inspections', 'create ncrs', 'view qc-reports',
            'view work-orders',
        ]);

        // 6. procurement-officer
        $procurement = Role::firstOrCreate(['name' => 'procurement-officer']);
        $procurement->syncPermissions([
            'view dashboard', 'view mrp', 'run mrp', 'create requisitions',
            'view work-orders',
        ]);

        // 7. finance-officer
        $finance = Role::firstOrCreate(['name' => 'finance-officer']);
        $finance->syncPermissions([
            'view dashboard', 'view invoices', 'create invoices', 'download invoices',
            'view reports', 'export reports',
        ]);

        // 8. stores-officer
        $stores = Role::firstOrCreate(['name' => 'stores-officer']);
        $stores->syncPermissions([
            'view dashboard', 'view mrp', 'create requisitions',
        ]);

        // 9. sales-officer
        $sales = Role::firstOrCreate(['name' => 'sales-officer']);
        $sales->syncPermissions([
            'view dashboard',
            'view rfqs', 'create rfqs', 'edit rfqs',
            'view quotations', 'create quotations', 'edit quotations',
            'view work-orders',
        ]);

        // 10. it-admin
        $itAdmin = Role::firstOrCreate(['name' => 'it-admin']);
        $itAdmin->syncPermissions([
            'view dashboard', 'manage users', 'manage roles', 'manage customers', 'view audit-log',
        ]);
    }
}
