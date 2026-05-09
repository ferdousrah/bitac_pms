<?php

namespace Database\Seeders;

use App\Models\Center;
use Illuminate\Database\Seeder;

class CenterSeeder extends Seeder
{
    public function run(): void
    {
        Center::firstOrCreate(['code' => 'DHK'], [
            'name'      => 'BITAC Dhaka',
            'code'      => 'DHK',
            'address'   => 'Tejgaon Industrial Area, Dhaka-1208',
            'phone'     => '+880-2-8870731',
            'email'     => 'dhaka@bitac.gov.bd',
            'is_active' => true,
        ]);
    }
}
