<?php

namespace Database\Seeders;

use App\Models\Material;
use Illuminate\Database\Seeder;

/**
 * Materials master seeder.
 *
 * Sourced from BITAC's "BITAC Job Costing Master File - PCD.xlsx" (Materials Rate + Density sheets).
 * Rates and densities are starting defaults — admins can adjust via the admin panel.
 */
class MaterialsSeeder extends Seeder
{
    public function run(): void
    {
        $materials = [
            // ── Quality / Tool Steels ─────────────────────────────────
            ['EN-24 (ATS, SB)',                'quality_steel', 350,  7850],
            ['EN-36 (AS, PS)',                 'quality_steel', 380,  7850],
            ['SKD-11, Hi-C Hi-Cr',             'tool_steel',    650,  7700],
            ['D2',                             'tool_steel',    600,  7700],
            ['D3',                             'tool_steel',    580,  7700],
            ['Cr-12',                          'tool_steel',    520,  7700],
            ['H13',                            'tool_steel',    700,  7800],
            ['Medium Carbon Steel',            'standard_steel',180,  7850],
            ['Quality Materials',              'quality_steel', 320,  7850],
            ['Special Materials',              'quality_steel', 450,  7850],
            ['Alloy Tool Steel',               'tool_steel',    480,  7800],

            // ── Standard Steels ──────────────────────────────────────
            ['Cast Iron',                      'cast_iron',     150,  7200],
            ['Cast Steel',                     'standard_steel',220,  7850],
            ['Steel',                          'standard_steel',180,  7850],
            ['Wrought Iron',                   'standard_steel',200,  7700],
            ['Iron Alloy',                     'standard_steel',230,  7800],
            ['Alloy C.I (Low Alloy)',          'cast_iron',     200,  7300],
            ['Alloy C.I (High Alloy)',         'cast_iron',     280,  7300],

            // ── Stainless Steels ─────────────────────────────────────
            ['Stainless Steel 304',            'stainless',     650,  7900],
            ['Stainless Steel 304 (Food Grade)','stainless',    700,  7900],
            ['Stainless Steel 316L (Pharma)',  'stainless',     950,  7900],
            ['Stainless Steel - Magnetic',     'stainless',     580,  7800],
            ['Stainless Steel - Non-Magnetic', 'stainless',     680,  7900],

            // ── Non-Ferrous: Aluminum ─────────────────────────────────
            ['Aluminum - 6061',                'aluminum',      450,  2700],
            ['Aluminum',                       'aluminum',      400,  2700],
            ['Aluminum Bronze (3-10% Al)',     'bronze',        950,  7700],
            ['Duralumin',                      'aluminum',      550,  2790],

            // ── Non-Ferrous: Copper / Brass / Bronze ──────────────────
            ['Copper',                         'copper',       1100,  8960],
            ['Brass - 60/40 Rolled and Drawn', 'brass',         750,  8500],
            ['Yellow Brass',                   'brass',         720,  8470],
            ['Red Brass',                      'brass',         780,  8740],
            ['Gun Metal',                      'bronze',        900,  8800],
            ['Bronze (8-14% Sn)',              'bronze',       1050,  8800],
            ['Bronze - Lead',                  'bronze',        980,  8900],
            ['Bronze - Phosphorous',           'bronze',       1020,  8800],
            ['Phosphor Bronze',                'bronze',       1100,  8800],
            ['Manganese Bronze',               'bronze',        950,  8400],
            ['Delta Metal',                    'brass',         800,  8500],
            ['Cupronickel',                    'specialty',    1450,  8900],
            ['Nickel Silver',                  'specialty',    1300,  8700],

            // ── Pure Metals ───────────────────────────────────────────
            ['Lead',                           'specialty',     280, 11340],
            ['Zinc',                           'specialty',     350,  7140],
            ['Tin',                            'specialty',    2200,  7280],
            ['Nickel',                         'specialty',    2500,  8900],
            ['Chromium',                       'specialty',    1800,  7190],
            ['Cobalt',                         'specialty',    4500,  8900],
            ['Manganese',                      'specialty',     750,  7430],
            ['Magnesium',                      'specialty',     900,  1738],
            ['Mercury',                        'specialty',    8000, 13534],
            ['Molybdenum',                     'specialty',    5500, 10220],
            ['Tungsten',                       'specialty',    6500, 19250],
            ['Vanadium',                       'specialty',    4200,  6110],
            ['Titanium',                       'specialty',    4800,  4506],
            ['Lithium',                        'specialty',    7500,   534],
            ['Germanium',                      'specialty',    9500,  5323],

            // ── Precious Metals ───────────────────────────────────────
            ['Silver',                         'precious',   95000, 10490],
            ['Gold',                           'precious', 1100000, 19320],

            // ── Alloys / Specialty ────────────────────────────────────
            ['Monel',                          'specialty',    2200,  8800],
            ['Nichrome',                       'specialty',    1800,  8400],
            ['White Metal',                    'specialty',     650,  7100],
            ['Babbitt Metal',                  'specialty',     700,  7300],
            ['Solder 50/50 Pb/Sn',             'specialty',     950,  8800],

            // ── Other ─────────────────────────────────────────────────
            ['Wood (Pattern)',                 'pattern',       180,   600],
            ['Propeller Shaft',                'specialty',     420,  7850],
            ['Stud Bolt',                      'specialty',     350,  7850],
        ];

        foreach ($materials as [$name, $category, $rate, $density_kg_m3]) {
            Material::updateOrCreate(
                ['name' => $name],
                [
                    'category'      => $category,
                    'rate_per_kg'   => $rate,
                    'density_kg_m3' => $density_kg_m3,
                    'is_active'     => true,
                ]
            );
        }

        $this->command->info('Seeded ' . count($materials) . ' materials.');
    }
}
