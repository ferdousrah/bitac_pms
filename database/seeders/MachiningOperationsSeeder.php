<?php

namespace Database\Seeders;

use App\Models\MachiningOperation;
use App\Models\Section;
use Illuminate\Database\Seeder;

/**
 * Machining operations master seeder.
 *
 * Sourced from BITAC's "BITAC Job Costing Master File - PCD.xlsx" (Machining sheet).
 * 3 pricing groups: A=Small/Cottage, B=Corp/Multinational, C=Import Substitute.
 */
class MachiningOperationsSeeder extends Seeder
{
    public function run(): void
    {
        $machineShop = Section::where('code', 'MACHINE_SHOP')->value('id');
        $cnc         = Section::where('code', 'CNC')->value('id');
        $casting     = Section::where('code', 'CASTING')->value('id');
        $heatTreat   = Section::where('code', 'HEAT_TREATMENT')->value('id');
        $fitting     = Section::where('code', 'FITTING')->value('id');

        $operations = [
            // [name, category, default_unit, group_a, group_b, group_c, section_id]
            // ── Lathe ─────────────────────────────────────────────
            ['Heavy Duty Lathe',                'machining', 'hour',  300,  450,  600, $machineShop],
            ['Medium & Precision Lathe',        'machining', 'hour',  250,  380,  500, $machineShop],
            ['Vertical Lathe',                  'machining', 'hour',  400,  600,  800, $machineShop],

            // ── Milling ───────────────────────────────────────────
            ['Heavy Duty Milling',              'machining', 'hour',  350,  525,  700, $machineShop],
            ['Medium & Precision Milling',      'machining', 'hour',  280,  420,  560, $machineShop],
            ['Copy Milling',                    'machining', 'hour',  400,  600,  800, $machineShop],
            ['Pentrograph',                     'machining', 'hour',  300,  450,  600, $machineShop],

            // ── Grinding ──────────────────────────────────────────
            ['Cylindrical Grinding',            'machining', 'hour',  320,  480,  640, $machineShop],
            ['Centerless Grinding',             'machining', 'hour',  350,  525,  700, $machineShop],
            ['Tool Grinding',                   'machining', 'hour',  280,  420,  560, $machineShop],
            ['Jig Grinding',                    'machining', 'hour',  450,  675,  900, $machineShop],
            ['Planner Grinding',                'machining', 'hour',  300,  450,  600, $machineShop],

            // ── Drilling / Boring ─────────────────────────────────
            ['Drill',                           'machining', 'hour',  200,  300,  400, $machineShop],
            ['Radial Drill',                    'machining', 'hour',  250,  375,  500, $machineShop],
            ['Tapping',                         'machining', 'hour',  180,  270,  360, $machineShop],
            ['Jig Boring (Old)',                'machining', 'hour',  400,  600,  800, $machineShop],
            ['Jig Boring (New)',                'machining', 'hour',  500,  750, 1000, $machineShop],
            ['Boring (Old)',                    'machining', 'hour',  350,  525,  700, $machineShop],
            ['Boring (New)',                    'machining', 'hour',  450,  675,  900, $machineShop],

            // ── Other Machining ───────────────────────────────────
            ['Shaper',                          'machining', 'hour',  220,  330,  440, $machineShop],
            ['Slotting',                        'machining', 'hour',  280,  420,  560, $machineShop],
            ['Planner Machining',               'machining', 'hour',  300,  450,  600, $machineShop],
            ['Gear Hob',                        'machining', 'hour',  450,  675,  900, $machineShop],
            ['Bend Saw',                        'machining', 'hour',  150,  225,  300, $machineShop],

            // ── CNC ───────────────────────────────────────────────
            ['VMC',                             'machining', 'hour',  600,  900, 1200, $cnc],
            ['Wire Cut',                        'machining', 'hour',  500,  750, 1000, $cnc],
            ['EDM',                             'machining', 'hour',  550,  825, 1100, $cnc],

            // ── Sheet Metal / Press ───────────────────────────────
            ['Sheet Cutting',                   'fabrication', 'hour', 200,  300,  400, $machineShop],
            ['Sheet Bending',                   'fabrication', 'hour', 220,  330,  440, $machineShop],
            ['Sheet Rolling',                   'fabrication', 'hour', 250,  375,  500, $machineShop],
            ['Hydraulic Press',                 'fabrication', 'hour', 350,  525,  700, $machineShop],
            ['Mechanical Press',                'fabrication', 'hour', 280,  420,  560, $machineShop],
            ['Percussion Machine',              'fabrication', 'hour', 200,  300,  400, $machineShop],

            // ── Welding & Fitting ─────────────────────────────────
            ['Welding (Excluding Electrode)',   'fabrication', 'hour', 280,  420,  560, $machineShop],
            ['Die & Mold Fitting Work',         'fabrication', 'hour', 320,  480,  640, $fitting],
            ['Pattern Cost',                    'fabrication', 'pcs',  500,  750, 1000, $casting],

            // ── Casting ───────────────────────────────────────────
            ['Gun Metal Casting',               'casting',   'kg',     180,  270,  360, $casting],
            ['P/Al Bronze Casting',             'casting',   'kg',     200,  300,  400, $casting],
            ['Al Casting',                      'casting',   'kg',     150,  225,  300, $casting],
            ['C.I Casting Simple',              'casting',   'kg',     120,  180,  240, $casting],
            ['C.I Casting Complex',             'casting',   'kg',     180,  270,  360, $casting],
            ['Alloy C.I (Low Alloy)',           'casting',   'kg',     160,  240,  320, $casting],
            ['Alloy C.I (High Alloy)',          'casting',   'kg',     220,  330,  440, $casting],

            // ── Plating / Coating ─────────────────────────────────
            ['Bright Crome Plating',            'plating',   'sqft',   180,  270,  360, $heatTreat],
            ['Hard Crome Plating',              'plating',   'sqft',   250,  375,  500, $heatTreat],
            ['Zn Plating',                      'plating',   'sqft',   100,  150,  200, $heatTreat],
            ['Zn + Cad Plating',                'plating',   'sqft',   150,  225,  300, $heatTreat],
            ['Nickel Plating',                  'plating',   'sqft',   220,  330,  440, $heatTreat],
            ['Silver Coating',                  'plating',   'sqft',   400,  600,  800, $heatTreat],

            // ── Heat Treatment ────────────────────────────────────
            ['Heat Treatment',                  'heat_treatment', 'kg', 80, 120, 160, $heatTreat],
            ['Annealing',                       'heat_treatment', 'kg', 60,  90, 120, $heatTreat],
            ['White Metalling Lead Base',       'heat_treatment', 'kg',150, 225, 300, $heatTreat],
            ['White Metalling Tin Base',        'heat_treatment', 'kg',180, 270, 360, $heatTreat],

            // ── Surface / Finishing ───────────────────────────────
            ['Polishing',                       'surface_treatment', 'hour', 200, 300, 400, $machineShop],

            // ── Embossing / Marking ───────────────────────────────
            ['Embossing Machine',               'other', 'hour',  250,  375,  500, $machineShop],
            ['Marking Hammer',                  'other', 'hour',  100,  150,  200, $machineShop],
            ['Letter Inserting',                'other', 'hour',  150,  225,  300, $machineShop],
            ['Number Inserting',                'other', 'hour',  150,  225,  300, $machineShop],
            ['Medal Embossing',                 'other', 'hour',  280,  420,  560, $machineShop],
            ['Signature Die',                   'other', 'pcs',  1500, 2250, 3000, $machineShop],
            ['Embossing (Gold)',                'other', 'pcs',  3500, 5250, 7000, $machineShop],
            ['Embossing (Bronze)',              'other', 'pcs',  2000, 3000, 4000, $machineShop],
            ['Embossing (Replica)',             'other', 'pcs',  1800, 2700, 3600, $machineShop],
            ['Sealing Pliers',                  'other', 'hour',  120,  180,  240, $machineShop],
        ];

        $order = 1;
        foreach ($operations as [$name, $category, $unit, $a, $b, $c, $sectionId]) {
            MachiningOperation::updateOrCreate(
                ['name' => $name],
                [
                    'category'      => $category,
                    'default_unit'  => $unit,
                    'rate_group_a'  => $a,
                    'rate_group_b'  => $b,
                    'rate_group_c'  => $c,
                    'section_id'    => $sectionId,
                    'is_active'     => true,
                    'display_order' => $order++,
                ]
            );
        }

        $this->command->info('Seeded ' . count($operations) . ' machining operations.');
    }
}
