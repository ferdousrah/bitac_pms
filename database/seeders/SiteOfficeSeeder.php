<?php

namespace Database\Seeders;

use App\Models\Center;
use App\Models\SiteOffice;
use Illuminate\Database\Seeder;

/**
 * BITAC's offices and contact persons for the public Contact page.
 *
 * ⚠️ **Copied from BITAC's own website, bitac.gov.bd, on 2026-10-20** — the
 * regional office pages (যোগাযোগ, কেন্দ্র প্রধান) and the official e-mail list
 * (বিটাকের সকল দাপ্তরিক ই-মেইল তালিকা). Nothing here is invented.
 *
 * ⚠️ **It goes stale, and parts of it already may be.** The centre-head pages
 * were last updated between 2020 and 2024 and officers are transferred; the
 * e-mail list was updated July 2026. Check the named people and their mobiles
 * before the site goes live — Admin → Website → Offices.
 *
 * Choices made while copying, each deliberate:
 *  - Where a centre head's page gives a PERSONAL address (yahoo.com) and the
 *    official list gives the post's @bitac.gov.bd address, the official one
 *    is used — a government page should not publish a private mailbox, and
 *    the post's address survives the officer being transferred.
 *  - The Chattogram head's "office telephone" on bitac.gov.bd carries
 *    Chandpur's area code (0841) — a copy-paste slip on that page — so it is
 *    left out rather than published wrong.
 *  - The Tool & Technology Institute is in the official list but has no
 *    address published, so it has no office here.
 *  - Dhaka links to the PMS centre and takes its address and phones from that
 *    letterhead; only what the letterhead lacks (fax) is set here.
 *
 * ⚠️ **Map pins.** Each office was looked up on Google Maps (2026-10-20) and
 * the point Google resolves for it is pinned, so a map cannot drift if
 * Google's search changes. Dhaka (Tejgaon I/A), Chattogram (Pahartali),
 * Khulna (Shiromoni) and Chandpur all land where their addresses say.
 * **Bogura does not resolve** — one search lands in the Bay of Bengal,
 * another on BITAC Dhaka — so it has no pin and its map shows the Nishindara
 * neighbourhood its address names. Drop the exact pin in the admin.
 *
 * A seeder, not a migration: it is somebody's mobile number, and it must be
 * looked at before production rather than arrive on deploy. Keyed on the
 * office slug and the contact's designation, so a re-run adds nothing twice
 * and never overwrites an edit.
 *
 *   php artisan db:seed --class=SiteOfficeSeeder
 */
class SiteOfficeSeeder extends Seeder
{
    public function run(): void
    {
        $dhaka = Center::withoutGlobalScopes()->where('code', 'DHK')->value('id');

        $offices = [
            [
                'slug' => 'dhaka', 'name' => 'বিটাক প্রধান কার্যালয় ও বিটাক, ঢাকা', 'center_id' => $dhaka,
                'is_head_office' => true,
                // Address and phones come from the Dhaka letterhead.
                'fax' => '+৮৮-০২-৫৫০৩০০৪৯',
                'map_query' => 'Bangladesh Industrial Technical Assistance Centre, Tejgaon Industrial Area, Dhaka 1208',
                'latitude' => 23.7609091, 'longitude' => 90.4024383,
                'contacts' => [
                    ['designation' => 'মহাপরিচালক (অতিরিক্ত সচিব)', 'email' => 'dg@bitac.gov.bd'],
                    ['designation' => 'পরিচালক (গবেষণা ও উন্নয়ন) ও কেন্দ্র প্রধান, বিটাক, ঢাকা', 'email' => 'addhaka@bitac.gov.bd'],
                    ['designation' => 'পরিচালক (প্রকৌশল ও উৎপাদন)', 'email' => 'dir_ep@bitac.gov.bd'],
                    ['designation' => 'পরিচালক (প্রশিক্ষণ)', 'email' => 'director_training@bitac.gov.bd'],
                    ['designation' => 'নির্বাহী প্রকৌশলী (শিল্প প্রকৌশল বিভাগ)', 'email' => 'ieddhaka@bitac.gov.bd'],
                    ['designation' => 'নির্বাহী প্রকৌশলী (উৎপাদন নিয়ন্ত্রণ বিভাগ)', 'email' => 'xen_pcddhaka@bitac.gov.bd'],
                    ['designation' => 'সহকারী প্রকৌশলী, জনসংযোগ বিভাগ', 'email' => 'prodhaka@bitac.gov.bd'],
                ],
            ],
            [
                'slug' => 'chattogram', 'name' => 'বিটাক, চট্টগ্রাম',
                'address' => 'সাগরিকা রোড, পাহাড়তলী, চট্টগ্রাম-৪২১৯',
                'phone' => '৭৫১৫৭৬, ৭৫০০০৩', 'fax' => '৮৮-০৩১-৭৫১৪৭৭',
                'map_query' => 'BITAC Chattogram, Sagorika Road, Pahartali, Chattogram 4219',
                'latitude' => 22.3560613, 'longitude' => 91.7750430,
                'contacts' => [
                    ['name' => 'জনাব মোঃ আব্দুল মুবিন', 'designation' => 'অতিরিক্ত পরিচালক (কেন্দ্র প্রধান)',
                     'mobile' => '+৮৮০১৮১৯৩৫৯২৭৭', 'email' => 'adctg@bitac.gov.bd'],
                    ['designation' => 'পরিচালক', 'email' => 'directorctg@bitac.gov.bd'],
                    ['designation' => 'শিল্প প্রকৌশল বিভাগ (আইইডি)', 'email' => 'iedctg@bitac.gov.bd'],
                    ['designation' => 'উৎপাদন নিয়ন্ত্রণ বিভাগ (পিসিডি)', 'email' => 'pcdctg@bitac.gov.bd'],
                    ['designation' => 'প্রশিক্ষণ বিভাগ', 'email' => 'trainingctg@bitac.gov.bd'],
                ],
            ],
            [
                'slug' => 'chandpur', 'name' => 'বিটাক, চাঁদপুর',
                'address' => 'কুমিল্লা রোড, জিপিও বক্স নং: ১০, ষোলঘোর, চাঁদপুর-৩৬০০',
                'phone' => '০২৩৩৪৪৮৭৪৪০, ০২৩৩৪৪৮৫৬৬০', 'fax' => '০২৩৩৪৪৮৭৪৪০', 'email' => 'bitac.cdr@gmail.com',
                'map_query' => 'BITAC Chandpur',
                'latitude' => 23.2370371, 'longitude' => 90.6786871,
                'contacts' => [
                    ['name' => 'জনাব মোঃ ওমর ফারুক', 'designation' => 'নির্বাহী প্রকৌশলী (কেন্দ্র প্রধান)',
                     'phone' => '+৮৮-০৮৪১-৬৬৭০৩', 'mobile' => '+৮৮০১৮৩২৮৭০৭৮২'],
                    ['designation' => 'অতিরিক্ত পরিচালক', 'email' => 'adchandpur@bitac.gov.bd'],
                    ['designation' => 'উৎপাদন নিয়ন্ত্রণ বিভাগ (পিসিডি)', 'email' => 'pcdchandpur@bitac.gov.bd'],
                    ['designation' => 'প্রশিক্ষণ বিভাগ', 'email' => 'trainingchandpur@bitac.gov.bd'],
                ],
            ],
            [
                'slug' => 'khulna', 'name' => 'বিটাক, খুলনা',
                'address' => 'প্লট নং: আর ১-৪, শিরোমনি শিল্প এলাকা, ডাকঘর: শিরোমনি, খুলনা-৯২০৪',
                'phone' => '০২-৪৭৭৭০৭০৪৬, ০২-৪৭৭৭০৭১৫৩',
                'map_query' => 'BITAC Khulna, Shiromoni Industrial Area, Khulna 9204',
                'latitude' => 22.9087065, 'longitude' => 89.5121414,
                'contacts' => [
                    ['name' => 'পীযুষ সেন', 'designation' => 'নির্বাহী প্রকৌশলী (কেন্দ্র প্রধান)',
                     'phone' => '০২-৪৭৭৭০৭০৪৬', 'mobile' => '+৮৮০১৮২৬১১১৮০৬', 'email' => 'ad_khulna@bitac.gov.bd'],
                    ['designation' => 'শিল্প প্রকৌশল বিভাগ (আইইডি)', 'email' => 'ied_khulna@bitac.gov.bd'],
                    ['designation' => 'উৎপাদন নিয়ন্ত্রণ বিভাগ (পিসিডি)', 'email' => 'pcd_khulna@bitac.gov.bd'],
                    ['designation' => 'প্রশিক্ষণ বিভাগ', 'email' => 'training_khulna@bitac.gov.bd'],
                ],
            ],
            [
                'slug' => 'bogura', 'name' => 'বিটাক, বগুড়া',
                'address' => 'শান্তাহার রোড, কারবালা, নিশিন্দারা, বগুড়া-৫৮০০',
                'phone' => '০৫১-৫১৯৩১', 'fax' => '০৫১-৫১৯৩২', 'email' => 'bitac.bogra@gmail.com',
                // No reliable pin — see the class comment. The neighbourhood.
                'map_query' => 'Nishindara, Bogura',
                'contacts' => [
                    ['name' => 'জনাব মোঃ সালাউদ্দিন', 'designation' => 'অতিরিক্ত পরিচালক (কেন্দ্র প্রধান)',
                     'phone' => '+৮৮-০৫১-৫১৯৩২', 'mobile' => '০১৯১১৭৬২১৩৬', 'email' => 'adbogra@bitac.gov.bd'],
                    ['designation' => 'পরিচালক', 'email' => 'directorbogra@bitac.gov.bd'],
                    ['designation' => 'নির্বাহী প্রকৌশলী', 'email' => 'xen_bogura@bitac.gov.bd'],
                    ['designation' => 'প্রশিক্ষণ বিভাগ', 'email' => 'trainingbogra@bitac.gov.bd'],
                ],
            ],
        ];

        foreach ($offices as $i => $o) {
            $contacts = $o['contacts'];
            unset($o['contacts']);

            $office = SiteOffice::firstOrCreate(['slug' => $o['slug']], $o + ['sort' => $i + 1, 'is_active' => true]);

            foreach ($contacts as $j => $c) {
                $office->contacts()->firstOrCreate(
                    ['designation' => $c['designation']],
                    $c + ['sort' => $j + 1, 'is_active' => true],
                );
            }
            $this->command?->line("  {$office->name}: " . $office->contacts()->count() . ' contacts');
        }

        $this->command?->warn('Offices copied from bitac.gov.bd (2026-10-20). Some centre-head pages date from 2020–2024 — verify names and mobiles under Admin → Website → Offices before going live.');
    }
}
