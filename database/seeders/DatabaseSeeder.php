<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CenterSeeder::class,          // Must be first — all other seeders need center_id=1
            RolesAndPermissionsSeeder::class,
            UserSeeder::class,
            CustomerSeeder::class,
            WorkCentreSeeder::class,
            ProductSeeder::class,
            DemoWorkflowSeeder::class,
        ]);
    }
}
