<?php

namespace Database\Seeders;

use App\Models\MaterialCategory;
use Illuminate\Database\Seeder;

class MaterialCategorySeeder extends Seeder
{
    public function run(): void
    {
        // Codes MUST match the snake_case values currently stored in
        // materials.category — otherwise existing materials would no
        // longer resolve to a category name.
        $defaults = [
            ['code' => 'quality_steel',  'name' => 'Quality Steel'],
            ['code' => 'tool_steel',     'name' => 'Tool Steel'],
            ['code' => 'standard_steel', 'name' => 'Standard Steel'],
            ['code' => 'cast_iron',      'name' => 'Cast Iron'],
            ['code' => 'stainless',      'name' => 'Stainless'],
            ['code' => 'aluminum',       'name' => 'Aluminum'],
            ['code' => 'copper',         'name' => 'Copper'],
            ['code' => 'brass',          'name' => 'Brass'],
            ['code' => 'bronze',         'name' => 'Bronze'],
            ['code' => 'precious',       'name' => 'Precious'],
            ['code' => 'specialty',      'name' => 'Specialty'],
            ['code' => 'pattern',        'name' => 'Pattern'],
        ];

        foreach ($defaults as $i => $row) {
            MaterialCategory::updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'display_order' => $i + 1, 'is_active' => true],
            );
        }
    }
}
