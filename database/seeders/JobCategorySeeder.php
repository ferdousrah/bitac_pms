<?php

namespace Database\Seeders;

use App\Models\JobCategory;
use Illuminate\Database\Seeder;

class JobCategorySeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['name' => 'Machining',          'code' => 'MCH', 'description' => 'General machining jobs (turning, milling, drilling)'],
            ['name' => 'Fabrication',        'code' => 'FAB', 'description' => 'Welding, sheet metal, structural fabrication'],
            ['name' => 'Heat Treatment',     'code' => 'HT',  'description' => 'Hardening, tempering, normalising'],
            ['name' => 'Surface Treatment',  'code' => 'ST',  'description' => 'Plating, painting, polishing'],
            ['name' => 'Tool & Die',         'code' => 'TD',  'description' => 'Tooling, dies, jigs, fixtures'],
            ['name' => 'Spare Parts',        'code' => 'SP',  'description' => 'Industrial spare parts'],
            ['name' => 'Repair & Overhaul',  'code' => 'RO',  'description' => 'Repair, refurbishment, overhaul work'],
            ['name' => 'Training & Testing', 'code' => 'TT',  'description' => 'Industrial training, material testing'],
            ['name' => 'R&D',                'code' => 'RD',  'description' => 'Research and development jobs'],
        ];

        foreach ($defaults as $i => $row) {
            JobCategory::withoutGlobalScopes()->updateOrCreate(
                ['center_id' => null, 'name' => $row['name']],
                ['code' => $row['code'], 'description' => $row['description'], 'display_order' => $i + 1, 'is_active' => true],
            );
        }
    }
}
