<?php

namespace Database\Seeders;

use App\Models\GatePassConditionNote;
use Illuminate\Database\Seeder;

class GatePassConditionNoteSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'New / Unused',
            'Used — Working Condition',
            'Used — Worn / Damaged',
            'Re-machined / Repaired',
            'Polished / Finished',
            'Heat Treated',
            'For Inspection',
            'Sample / Specimen',
            'Defective — Awaiting Rework',
            'Returned to Customer',
        ];

        foreach ($defaults as $i => $label) {
            GatePassConditionNote::updateOrCreate(
                ['label' => $label],
                ['display_order' => $i + 1, 'is_active' => true],
            );
        }
    }
}
