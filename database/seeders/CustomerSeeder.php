<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            [
                'name'            => 'Bangladesh Railway',
                'contact_person'  => 'Md. Aminul Islam',
                'email'           => 'railway@customer.bitac.gov.bd',
                'phone'           => '01711-000001',
                'address'         => 'Rail Bhaban, Abdul Gani Road, Dhaka-1000',
                'is_active'       => true,
            ],
            [
                'name'            => 'BPDB (Bangladesh Power Development Board)',
                'contact_person'  => 'Engr. Rahim Uddin',
                'email'           => 'bpdb@customer.bitac.gov.bd',
                'phone'           => '01711-000002',
                'address'         => 'WAPDA Building, Motijheel, Dhaka-1000',
                'is_active'       => true,
            ],
            [
                'name'            => 'Bangladesh Shipyard',
                'contact_person'  => 'Captain Fazlul Haque',
                'email'           => 'shipyard@customer.bitac.gov.bd',
                'phone'           => '01711-000003',
                'address'         => 'Chittagong Port Area, Chittagong',
                'is_active'       => true,
            ],
        ];

        foreach ($customers as $data) {
            // Model cast 'password' => 'hashed' auto-hashes on save. Don't double-hash.
            Customer::firstOrCreate(
                ['email' => $data['email']],
                array_merge($data, ['password' => 'password'])
            );
        }
    }
}
