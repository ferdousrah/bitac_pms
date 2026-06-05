<?php

namespace Database\Seeders;

use App\Models\PortfolioProject;
use Illuminate\Database\Seeder;

/**
 * Sample BITAC portfolio entries. Sourced from real BITAC capability areas
 * (pump impellers, sugar-mill rollers, railway spares, power plant
 * components, machinery components, etc.) so the public Portfolio page has
 * something representative to show out of the box. Admins should refine
 * via /admin/portfolio later — and add real photos via the gallery upload.
 */
class PortfolioProjectsSeeder extends Seeder
{
    public function run(): void
    {
        $samples = [
            [
                'title'        => 'Pump Impeller — ACI Motors',
                'client_name'  => 'ACI Motors Ltd.',
                'category'     => 'Casting',
                'summary'      => 'Centrifugal pump impeller cast in SS304 stainless and dynamically balanced for agricultural irrigation pumps.',
                'description'  => "Cast and finished a 12-inch centrifugal pump impeller in 304-grade stainless steel for ACI Motors' agricultural pump line. Sand-cast at BITAC Foundry, machined on heavy-duty VTL, hand-finished and dynamically balanced to ISO 1940 G6.3. Delivered within 18 working days against a target of 25.\n\nKey challenge was achieving the as-cast surface finish on the vane profile without secondary machining — solved by upgrading the pattern's draft angles and using shell mould inserts at the eye.",
                'specs'        => [
                    ['label' => 'Material',     'value' => 'SS304 / Cast'],
                    ['label' => 'Diameter',     'value' => 'Ø305 mm'],
                    ['label' => 'Quantity',     'value' => '4 pcs'],
                    ['label' => 'Lead Time',    'value' => '18 working days'],
                    ['label' => 'Balance Grade','value' => 'ISO 1940 G6.3'],
                ],
                'completed_at' => '2025-09-12',
            ],
            [
                'title'        => 'Sugar Mill Roller Shaft — Carew & Co.',
                'client_name'  => 'Carew & Co. (Bangladesh) Ltd.',
                'category'     => 'Machining',
                'summary'      => 'Heavy-duty sugar-mill roller shaft turned from forged EN-24 and hardened for the Darshana plant.',
                'description'  => "Imported substitute for an Italian-OEM roller shaft for Carew's Darshana sugar mill. Started from a 1.2-tonne forged EN-24 billet; rough turned, normalised, semi-finished, induction-hardened on the journals, and ground to spec on our cylindrical grinder.\n\nFinished shaft tested for hardness (HRC 48-52 on journals, HRC 28-32 on body) and dimensionally verified at BITAC's metrology lab. Saves about ৳18 lakh per shaft compared to imported equivalent.",
                'specs'        => [
                    ['label' => 'Material',         'value' => 'EN-24 Forged'],
                    ['label' => 'Length',           'value' => '2,850 mm'],
                    ['label' => 'Body Diameter',    'value' => 'Ø305 mm'],
                    ['label' => 'Finish Weight',    'value' => '1.05 t'],
                    ['label' => 'Hardness (Journal)','value' => 'HRC 48-52'],
                ],
                'completed_at' => '2025-07-25',
            ],
            [
                'title'        => 'Locomotive Brake Block — Bangladesh Railway',
                'client_name'  => 'Bangladesh Railway',
                'category'     => 'Casting',
                'summary'      => 'Composite cast-iron brake blocks for broad-gauge locomotives — full import substitute, made at BITAC foundry.',
                'description'  => "Large-batch production of cast-iron brake blocks for Bangladesh Railway's broad-gauge fleet. Manufactured from grade 200 grey cast iron in BITAC's induction-furnace foundry, with hardness and wear-rate testing on every melt.\n\nThis is a recurring contract — 5,000 pcs per quarter — replacing imported blocks from India. Lead-time and cost both more than halved.",
                'specs'        => [
                    ['label' => 'Material',     'value' => 'CI Grade 200'],
                    ['label' => 'Block Mass',   'value' => '8.5 kg'],
                    ['label' => 'Batch',        'value' => '5,000 pcs / quarter'],
                    ['label' => 'Hardness',     'value' => 'HB 197-241'],
                    ['label' => 'Test',         'value' => 'BR ROH-09 spec'],
                ],
                'completed_at' => '2026-01-15',
            ],
            [
                'title'        => 'BPDB Turbine Blade Refurbishment',
                'client_name'  => 'Bangladesh Power Development Board',
                'category'     => 'Repair & Overhaul',
                'summary'      => 'High-pressure stage steam-turbine blades welded, ground and dynamically rebalanced for Ghorashal Unit 4.',
                'description'  => "Turbine blade refurbishment for BPDB's Ghorashal 210 MW Unit 4. Damaged tips repaired by TIG-weld build-up with Inconel 625 filler, ground to original profile on CNC 5-axis, dynamic balancing performed on the assembled rotor at BITAC.\n\nFull non-destructive testing (dye-penetrant + ultrasonic) on every blade post-repair. Overhaul completed within the 14-day plant outage window.",
                'specs'        => [
                    ['label' => 'Plant',           'value' => 'Ghorashal Unit 4 — 210 MW'],
                    ['label' => 'Blades Repaired', 'value' => '48 pcs'],
                    ['label' => 'Filler Metal',    'value' => 'Inconel 625'],
                    ['label' => 'NDT',             'value' => 'DPT + UT (100%)'],
                    ['label' => 'Window',          'value' => '14 days'],
                ],
                'completed_at' => '2025-11-30',
            ],
            [
                'title'        => 'Sluice Gate Spindle — BWDB',
                'client_name'  => 'Bangladesh Water Development Board',
                'category'     => 'Machining',
                'summary'      => 'Trapezoidal-thread sluice-gate operating spindles in 316L stainless for coastal-belt water-control structures.',
                'description'  => "Salt-water-rated sluice-gate spindles for BWDB's coastal water-management scheme. Thread cut on heavy-duty lathe (Tr 60×9, single-start), passivated and polished for corrosion resistance, and end-tested under 50 kN load.\n\nThe 316L grade was specified specifically because the original mild-steel spindles were failing within 18-24 months in saline conditions.",
                'specs'        => [
                    ['label' => 'Material',  'value' => 'SS316L'],
                    ['label' => 'Thread',    'value' => 'Tr 60×9 (single start)'],
                    ['label' => 'Length',    'value' => '4,200 mm'],
                    ['label' => 'Quantity',  'value' => '12 pcs'],
                    ['label' => 'Finish',    'value' => 'Passivated + polished'],
                ],
                'completed_at' => '2025-10-08',
            ],
            [
                'title'        => 'Precision Jig — Walton Hi-Tech',
                'client_name'  => 'Walton Hi-Tech Industries',
                'category'     => 'Tool & Die',
                'summary'      => 'Drill-and-bore jig for Walton compressor housing line — heat-treated D2 inserts, EDM-finished location pads.',
                'description'  => "Multi-position drill-and-bore jig for Walton's domestic-compressor housing assembly line. Body in EN-24, working faces in HRC 60 D2 inserts ground flat to 5 microns. Location pads finished by wire-EDM for repeatable indexing.\n\nCommissioned on Walton's line; cycle time reduced by 22% and reject rate from 4.1% to 0.6% on the bearing-bore alignment.",
                'specs'        => [
                    ['label' => 'Body Material',  'value' => 'EN-24'],
                    ['label' => 'Insert Material','value' => 'D2 / HRC 60'],
                    ['label' => 'Stations',       'value' => '6'],
                    ['label' => 'Tolerance',      'value' => '±0.005 mm'],
                    ['label' => 'EDM Finish',     'value' => 'Ra 0.8 µm'],
                ],
                'completed_at' => '2025-08-19',
            ],
            [
                'title'        => 'Bevel Gear Set — Sugar Industry',
                'client_name'  => 'Mobarakganj Sugar Mills Ltd.',
                'category'     => 'Heat Treatment',
                'summary'      => 'Spiral bevel gear set for cane carrier drive — case-carburised 20MnCr5 and lapped as a matched pair.',
                'description'  => "Pinion + crown bevel gear set for the cane-carrier drive at Mobarakganj. 20MnCr5 blanks gear-cut on bevel generator, case-carburised to 0.9-1.2 mm effective case depth, oil-quenched and tempered to HRC 58-62 surface / HRC 30-35 core. Final lapped as a matched pair on BITAC's bevel-gear lapper.\n\nLifetime in field has exceeded 18 months of season operation against the imported 12-month average.",
                'specs'        => [
                    ['label' => 'Material',      'value' => '20MnCr5'],
                    ['label' => 'Pinion Z',      'value' => '14 teeth'],
                    ['label' => 'Crown Z',       'value' => '67 teeth'],
                    ['label' => 'Module',        'value' => '8 mm'],
                    ['label' => 'Surface',       'value' => 'HRC 58-62 (carburised)'],
                ],
                'completed_at' => '2026-03-04',
            ],
            [
                'title'        => 'Pattern Making — Foundry Trade',
                'client_name'  => 'BITAC Internal Training',
                'category'     => 'Pattern',
                'summary'      => 'Wood + resin master patterns developed in-house to support BITAC casting trade training.',
                'description'  => "Library of foundry master patterns built up for BITAC's pattern-making training course — includes pump volutes, valve bodies, gear blanks, machine bases. Used both for trainee practice and as the in-house pattern set for small-batch casting jobs.\n\nA representative set of these patterns is displayed in the casting trade gallery; visiting industry teams have used them as references during plant-visit training.",
                'specs'        => [
                    ['label' => 'Pattern Library', 'value' => '40+ master patterns'],
                    ['label' => 'Materials',       'value' => 'Teak / Mahogany / Resin'],
                    ['label' => 'Purpose',         'value' => 'Training + small-batch casting'],
                    ['label' => 'Maintained Since','value' => '2018'],
                ],
                'completed_at' => '2025-12-20',
            ],
        ];

        foreach ($samples as $i => $row) {
            PortfolioProject::updateOrCreate(
                ['title' => $row['title']],
                array_merge($row, [
                    'slug'          => PortfolioProject::generateUniqueSlug($row['title']),
                    'is_published'  => true,
                    'display_order' => $i + 1,
                ]),
            );
        }

        $this->command?->info('Seeded ' . count($samples) . ' portfolio projects.');
    }
}
