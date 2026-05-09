<?php

namespace Database\Seeders;

use App\Models\Machine;
use App\Models\WorkCentre;
use Illuminate\Database\Seeder;

class WorkCentreSeeder extends Seeder
{
    public function run(): void
    {
        $workCentres = [
            [
                'name'        => 'Machine Shop',
                'description' => 'CNC and conventional machining operations',
                'machines'    => [
                    ['name' => 'CNC Lathe 1',         'machine_code' => 'MS-CL-001'],
                    ['name' => 'CNC Milling Machine', 'machine_code' => 'MS-CM-002'],
                    ['name' => 'Conventional Lathe',  'machine_code' => 'MS-VL-003'],
                ],
            ],
            [
                'name'        => 'Heat Treatment',
                'description' => 'Heat treatment and hardening processes',
                'machines'    => [
                    ['name' => 'Furnace 1 (Box Type)',    'machine_code' => 'HT-BF-001'],
                    ['name' => 'Induction Hardener',      'machine_code' => 'HT-IH-002'],
                    ['name' => 'Salt Bath Furnace',       'machine_code' => 'HT-SB-003'],
                ],
            ],
            [
                'name'        => 'Fabrication',
                'description' => 'Metal fabrication and forming',
                'machines'    => [
                    ['name' => 'Press Brake 100T',    'machine_code' => 'FB-PB-001'],
                    ['name' => 'Shearing Machine',    'machine_code' => 'FB-SM-002'],
                    ['name' => 'Rolling Machine',     'machine_code' => 'FB-RM-003'],
                ],
            ],
            [
                'name'        => 'Welding',
                'description' => 'Welding and joining processes',
                'machines'    => [
                    ['name' => 'MIG Welder 1',   'machine_code' => 'WL-MG-001'],
                    ['name' => 'TIG Welder 1',   'machine_code' => 'WL-TG-002'],
                    ['name' => 'Arc Welder',      'machine_code' => 'WL-AW-003'],
                ],
            ],
            [
                'name'        => 'Assembly',
                'description' => 'Final assembly and testing',
                'machines'    => [
                    ['name' => 'Assembly Station 1', 'machine_code' => 'AS-ST-001'],
                    ['name' => 'Assembly Station 2', 'machine_code' => 'AS-ST-002'],
                    ['name' => 'Test Bench',         'machine_code' => 'AS-TB-003'],
                ],
            ],
        ];

        foreach ($workCentres as $wcData) {
            $wc = WorkCentre::firstOrCreate(
                ['name' => $wcData['name']],
                ['description' => $wcData['description'], 'is_active' => true]
            );

            foreach ($wcData['machines'] as $machineData) {
                Machine::firstOrCreate(
                    ['machine_code' => $machineData['machine_code']],
                    [
                        'work_centre_id' => $wc->id,
                        'name'           => $machineData['name'],
                        'status'         => 'active',
                    ]
                );
            }
        }
    }
}
