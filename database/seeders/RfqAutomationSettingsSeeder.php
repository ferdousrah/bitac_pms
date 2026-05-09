<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class RfqAutomationSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'rfq_auto.enabled'                  => 'true',
            'rfq_auto.auto_estimate_enabled'     => 'true',
            'rfq_auto.min_confidence_score'      => '40',
            'rfq_auto.default_profit_margin'     => '15',
            'rfq_auto.default_validity_days'     => '30',
            'rfq_auto.default_vat_rate'          => '15',
            'rfq_auto.auto_approve_threshold'    => '50000',
            'rfq_auto.followup_enabled'          => 'true',
            'rfq_auto.duplicate_detection_days'  => '90',
        ];

        foreach ($defaults as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
