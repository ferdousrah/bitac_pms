<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * Sample BITAC Head Office accounts (2026-10-26).
 *
 * ⚠️ PLACEHOLDERS. BITAC will put the real names, designations and emails in
 * through Admin → Users; the password is the seeded default `password` and
 * must be changed before anyone uses these on the live system.
 *
 * Head Office has **no centre** (`center_id` NULL) — it looks across every
 * centre and switches between them from the top bar. The role (migration
 * `..._000088`) only reads: dashboards, reports, jobs, bills, receivables.
 *
 * Idempotent: keyed on the email, and an account that already exists is left
 * exactly as it is — a re-run must not undo the real name someone typed in.
 *
 *   php artisan db:seed --class=HeadOfficeUserSeeder
 */
class HeadOfficeUserSeeder extends Seeder
{
    private const USERS = [
        ['email' => 'ho.dg@bitac.gov.bd',       'name' => 'Head Office — Director General', 'designation' => 'Director General'],
        ['email' => 'ho.director@bitac.gov.bd', 'name' => 'Head Office — Director',         'designation' => 'Director (Head Office)'],
        ['email' => 'ho.monitor@bitac.gov.bd',  'name' => 'Head Office — Monitoring',       'designation' => 'Monitoring Officer'],
    ];

    public function run(): void
    {
        $role = Role::where('name', 'Head Office')->where('guard_name', 'web')->first();
        if (! $role) {
            $this->command?->error('The "Head Office" role does not exist — run the migrations first (..._000088).');
            return;
        }

        foreach (self::USERS as $u) {
            $user = User::where('email', $u['email'])->first();
            if ($user) {
                $this->command?->line("  kept      {$u['email']} (already exists)");
                continue;
            }

            $user = User::create([
                'name'        => $u['name'],
                'email'       => $u['email'],
                'designation' => $u['designation'],
                'password'    => 'password',   // the 'hashed' cast hashes it
                'is_active'   => true,
                'center_id'   => null,         // every centre
            ]);
            $user->assignRole($role);
            $this->command?->info("  created   {$u['email']}");
        }

        $this->command?->warn('Sample Head Office accounts — rename them in Admin → Users and change the password before going live.');
    }
}
