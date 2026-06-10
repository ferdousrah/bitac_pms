<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Idempotently ensures every permission used anywhere in the app exists in
 * the database. New features are added here as they ship so the Role
 * edit grid never misses an option. Safe to run any time — uses
 * firstOrCreate.
 *
 * Permissions are kept flat (Spatie's native model) but the comment groups
 * mirror the sidebar nav for easy maintenance.
 */
class SyncPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $all = array_merge(
            // ── Dashboard / Core ──────────────────────────────────────
            ['view dashboard', 'view live dashboard', 'view audit-log'],

            // ── IED ───────────────────────────────────────────────────
            [
                'view rfqs', 'create rfqs', 'edit rfqs', 'delete rfqs', 'manage rfqs',
                'manage gate-passes',
                'view cost-estimates', 'create cost-estimates', 'edit cost-estimates',
                'view quotations', 'create quotations', 'edit quotations',
                'approve quotations', 'reject quotations', 'convert quotations',
                'create quotation-revision', 'submit quotation-to-customer',
                'manage complaints',
                'view completion-certificates', 'manage completion-certificates',
                'view consultancy-requests', 'manage consultancy-requests',
                'view service-demand', 'manage service-demand',
                'manage emergency-requests',
            ],

            // ── PCD ───────────────────────────────────────────────────
            [
                'view pcd', 'view pcd-inbox', 'access pcd',
                'create work-orders', 'edit work-orders', 'approve work-orders', 'view work-orders',
                'view operation-sheets', 'create operation-sheets', 'approve operation-sheets',
                'view schedule', 'manage schedule',
                'release-job-to-shops',
            ],

            // ── Production / Shop Floor ──────────────────────────────
            [
                'access shops', 'view production',
                'view shop-inbox', 'view shop-floor',
                'start jobs', 'stop jobs', 'log downtime',
                'mark shop-operation-complete',
                'view wip',
            ],

            // ── Quality / QC ──────────────────────────────────────────
            [
                'access qc',
                'view qc', 'view qc-reports',
                'create qc-inspections', 'create ncrs',
                'manage inspection-plans', 'manage defect-categories',
                'record dimensional-measurements',
            ],

            // ── MRP / Material Requisitions ──────────────────────────
            [
                'view mrp', 'run mrp',
                'create requisitions',
                'create material-requisitions', 'approve material-requisitions',
            ],

            // ── Delivery & Billing ───────────────────────────────────
            [
                'view delivery', 'create delivery', 'complete delivery',
                'view invoices', 'create invoices', 'download invoices',
            ],

            // ── Reports ──────────────────────────────────────────────
            ['view reports', 'export reports'],

            // ── Maintenance ──────────────────────────────────────────
            [
                'view maintenance-requests',
                'submit maintenance-requests',
                'approve maintenance-requests',
                'perform maintenance',
            ],

            // ── Master Data ──────────────────────────────────────────
            [
                'manage materials-master',
                'manage operations-master',
                'manage operators',
                'manage sections',
                'manage machines',
                'manage portfolio',
                'assign machines-operators', 'assign sections',
                'override machine-assignment', 'override operator-assignment',
                'manage gate-pass-notes',
                'manage job-categories',
            ],

            // ── Users & Access ───────────────────────────────────────
            [
                'manage users', 'manage roles', 'manage permissions',
                'manage customers',
                'view customer-portal',
            ],

            // ── IED / Org-wide access flag ───────────────────────────
            ['access ied'],

            // ── AI / Chatbot ─────────────────────────────────────────
            ['view ai-usage', 'manage chatbot'],

            // ── Collaboration ────────────────────────────────────────
            ['view meetings', 'create meetings', 'view meeting-analytics'],
        );

        // Idempotent: only creates rows that don't already exist.
        $created = 0;
        foreach (array_unique($all) as $name) {
            $name = trim($name);
            if ($name === '') continue;
            $perm = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            if ($perm->wasRecentlyCreated) $created++;
        }

        // Always re-grant ALL permissions to super-admin (so newly-created
        // ones are available without manually re-assigning).
        foreach (['super-admin', 'super_admin'] as $roleName) {
            $role = Role::where('name', $roleName)->first();
            if ($role) $role->syncPermissions(Permission::all());
        }

        // Clear Spatie's permission cache so the new perms are visible
        // immediately.
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $this->command?->info("SyncPermissionsSeeder: " . Permission::count() . " total perms ({$created} newly created).");
    }
}
