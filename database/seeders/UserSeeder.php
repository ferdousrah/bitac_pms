<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['name' => 'System Admin',         'email' => 'admin@bitac.gov.bd',        'role' => 'super-admin'],
            ['name' => 'Director General',     'email' => 'management@bitac.gov.bd',   'role' => 'management'],
            ['name' => 'Production Supervisor','email' => 'supervisor@bitac.gov.bd',   'role' => 'production-supervisor'],
            ['name' => 'Machine Operator',     'email' => 'operator@bitac.gov.bd',     'role' => 'machine-operator'],
            ['name' => 'QC Inspector',         'email' => 'qc@bitac.gov.bd',           'role' => 'qc-inspector'],
            ['name' => 'Procurement Officer',  'email' => 'procurement@bitac.gov.bd',  'role' => 'procurement-officer'],
            ['name' => 'Finance Officer',      'email' => 'finance@bitac.gov.bd',      'role' => 'finance-officer'],
            ['name' => 'Stores Officer',       'email' => 'stores@bitac.gov.bd',       'role' => 'stores-officer'],
            ['name' => 'Sales Officer',        'email' => 'sales@bitac.gov.bd',        'role' => 'sales-officer'],
            ['name' => 'IT Admin',             'email' => 'it@bitac.gov.bd',           'role' => 'it-admin'],
        ];

        foreach ($users as $userData) {
            $user = User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name'     => $userData['name'],
                    'password' => Hash::make('password'),
                ]
            );
            $user->assignRole($userData['role']);
        }
    }
}
