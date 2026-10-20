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
            // Sample logos for the public site's partners wall. The marks are
            // drawn placeholders, not anybody's real emblem -- replaced under
            // Admin > Website > Partners.
            PartnerSampleSeeder::class,
            // Sample news for the home page. The two events carry invented
            // dates -- edit or delete them under Admin > Website.
            NewsSampleSeeder::class,
            // Sample hero slides: freely licensed stock media from Wikimedia
            // Commons, credited on the page. Needs the internet; skips if not.
            HeroSampleSeeder::class,
        ]);
    }
}
