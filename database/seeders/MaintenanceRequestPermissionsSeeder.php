<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class MaintenanceRequestPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // 3 new permissions for the maintenance request workflow.
        $perms = [
            'submit maintenance-requests',   // shop floor / operators
            'approve maintenance-requests',  // managers
            'perform maintenance',           // technicians
        ];
        foreach ($perms as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        // Best-effort: grant submit to anyone who can run jobs on the shop floor.
        if ($shopFloor = Role::where('name', 'shop-floor-operator')->first()) {
            $shopFloor->givePermissionTo('submit maintenance-requests');
        }

        // Grant approve to any management-style role we can find.
        foreach (['management', 'production-manager', 'pcd-manager', 'plant-manager'] as $name) {
            if ($role = Role::where('name', $name)->first()) {
                $role->givePermissionTo(['submit maintenance-requests', 'approve maintenance-requests', 'perform maintenance']);
            }
        }
    }
}
