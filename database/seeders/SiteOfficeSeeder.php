<?php

namespace Database\Seeders;

use App\Models\Center;
use App\Models\SiteOffice;
use App\Models\SiteOfficeContact;
use Illuminate\Database\Seeder;

/**
 * BITAC's offices and contact persons for the public Contact page.
 *
 * ⚠️ **Copied from BITAC's own website, bitac.gov.bd, on 2026-10-20.** Nothing
 * here is invented. Three pages, in order of trust:
 *  1. **সকল কর্মকর্তাবৃন্দ** (/pages/officers) — the officers directory: name,
 *     designation, email, office phone and MOBILE for every officer, grouped by
 *     head office and centre. The most current of the three — it is where the
 *     names and mobiles come from.
 *  2. **বিটাকের সকল দাপ্তরিক ই-মেইল তালিকা** — each post's official address
 *     (updated July 2026). Where a post has no person yet, it is listed by its
 *     post and this address.
 *  3. Each centre's **যোগাযোগ** and **কেন্দ্র প্রধান** pages — the office
 *     addresses, phones and fax. Last updated 2020–2024.
 *
 * ⚠️ **It goes stale.** Officers are transferred. Check the people before the
 * site goes live, and after it — Admin → Website → Offices.
 *
 * Choices made while copying, each deliberate:
 *  - Only DIRECTORS and EXECUTIVE ENGINEERS are listed from the directory, not
 *    every assistant engineer — a visitor needs whoever can take a job, not
 *    the whole staff list.
 *  - Officers marked **শিক্ষা ছুটি** (study leave) are left out: they cannot be
 *    reached.
 *  - Personal mailboxes (gmail, yahoo) are left out; a post's own
 *    @bitac.gov.bd address is used instead.
 *  - Office phones that look mistyped on bitac.gov.bd are left out rather
 *    than published wrong: a Dhaka director's number carrying Chandpur's
 *    0233448 code, the Chattogram head's carrying Chandpur's 0841, and a
 *    Khulna number missing its leading digit.
 *  - Chandpur's head is **অতিরিক্ত পরিচালক** in the directory (his 2024 centre
 *    page still says নির্বাহী প্রকৌশলী); the directory is newer, so it wins, and
 *    the separate "অতিরিক্ত পরিচালক" post row is gone — it is him.
 *  - `addhaka@` is given to two people in the directory (the Dhaka centre head
 *    and an Assistant Director (Admin)) — a slip on that page; the designation
 *    makes it plain which is the কেন্দ্র প্রধান.
 *  - The Tool & Technology Institute has no published address, so no office.
 *  - Dhaka links to the PMS centre and takes its address and phones from that
 *    letterhead; only what the letterhead lacks (fax) is set here.
 *
 * ⚠️ **Map pins.** Each office was looked up on Google Maps (2026-10-20) and the
 * point Google resolves for it is pinned. Dhaka, Chattogram, Khulna and Chandpur
 * land where their addresses say (a rendered map shows the Khulna pin on
 * "Bangladesh Industrial Technical Assistance…", Cable Ghat Road). Bogura does
 * not resolve — one search lands in the Bay of Bengal, another on BITAC Dhaka —
 * so it maps the Nishindara neighbourhood its address names.
 *
 * ⚠️ **Re-running FILLS BLANKS, it never overwrites.** A contact is found by its
 * name (when it has one) or else its designation, and only the fields still
 * empty are set — so running it again after an editor has corrected a number
 * cannot put the old one back.
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
                'fax' => '+৮৮-০২-৫৫০৩০০৪৯',
                'map_query' => 'Bangladesh Industrial Technical Assistance Centre, Tejgaon Industrial Area, Dhaka 1208',
                'latitude' => 23.7609091, 'longitude' => 90.4024383,
                'contacts' => [
                    ['name' => 'মোঃ নূরুজ্জামান এনডিসি', 'designation' => 'মহাপরিচালক (অতিরিক্ত সচিব)',
                     'mobile' => '০১৭১১৯৬৬৫৫৭', 'phone' => '০২৫৫০৩০০৪২', 'email' => 'dg@bitac.gov.bd'],
                    ['name' => 'ড. ইঞ্জিঃ মোঃ মাঝহারুল হাবীব', 'designation' => 'পরিচালক (গবেষণা ও উন্নয়ন) ও কেন্দ্র প্রধান, বিটাক, ঢাকা',
                     'mobile' => '+৮৮০১৯৬৫৮১০২৮১; +৮৮০১৭৬০৪৮৮০৭৪', 'email' => 'addhaka@bitac.gov.bd'],
                    ['name' => 'মোঃ ফজলুল করিম', 'designation' => 'পরিচালক (প্রকৌশল ও উৎপাদন)',
                     'mobile' => '+৮৮০১৭১৬৮৬৯০৪২', 'phone' => '+৮৮-০২-৫৫০৩০০৫২', 'email' => 'dir_ep@bitac.gov.bd'],
                    ['name' => 'মোঃ জাহাঙ্গীর আলম', 'designation' => 'পরিচালক (প্রশিক্ষণ)',
                     'mobile' => '+৮৮০১৭১২৭৫৫৮৯০', 'email' => 'director_training@bitac.gov.bd'],
                    ['name' => 'মীর মোঃ আনিসুজ্জামান', 'designation' => 'নির্বাহী প্রকৌশলী (শিল্প প্রকৌশল বিভাগ)',
                     'mobile' => '+৮৮০১৯১৪৮৯৪০৮৫', 'email' => 'ieddhaka@bitac.gov.bd'],
                    ['name' => 'সুমিত কুমার রায়', 'designation' => 'নির্বাহী প্রকৌশলী (উৎপাদন নিয়ন্ত্রণ বিভাগ)',
                     'mobile' => '+৮৮০১৯১৭৮৮৪৮৪৭', 'phone' => '+৮৮-০২-৫৫০৩০০৪৬', 'email' => 'xen_pcddhaka@bitac.gov.bd'],
                    ['name' => 'মোঃ মাসুম জাকারিয়া', 'designation' => 'সহকারী প্রকৌশলী, জনসংযোগ বিভাগ',
                     'mobile' => '+৮৮০১৬৭১০৩৭১৯২', 'phone' => '+৮৮০২৮৮৭০৬৮০', 'email' => 'prodhaka@bitac.gov.bd'],
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
                     'mobile' => '+৮৮০১৮১৯৩৫৯২৭৭', 'phone' => '+৮৮০২৩৩৩৩৮০০০৩', 'email' => 'adctg@bitac.gov.bd'],
                    ['name' => 'ফারহানা আক্তার', 'designation' => 'নির্বাহী প্রকৌশলী (প্রশিক্ষণ)',
                     'mobile' => '+৮৮০১৫৫২৫৭৭২৬৪', 'phone' => '+৮৮-০৩১-২৭৭০০০৬', 'email' => 'xen_ctg2@bitac.gov.bd'],
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
                    ['name' => 'জনাব মোঃ ওমর ফারুক', 'designation' => 'অতিরিক্ত পরিচালক (কেন্দ্র প্রধান)',
                     'phone' => '+৮৮-০৮৪১-৬৬৭০৩', 'mobile' => '+৮৮০১৮৩২৮৭০৭৮২', 'email' => 'ch_chandpur@bitac.gov.bd'],
                    ['name' => 'সজল পৈত', 'designation' => 'নির্বাহী প্রকৌশলী',
                     'mobile' => '+৮৮০১৭৭১০৬৭২৮২', 'email' => 'xen_chandpur@bitac.gov.bd'],
                    ['name' => 'মোঃ সাইফুল ইসলাম', 'designation' => 'নির্বাহী প্রকৌশলী (উৎপাদন নিয়ন্ত্রণ ও শিল্প প্রকৌশল বিভাগ)',
                     'mobile' => '+৮৮০১৮১৮১৯৩৬৮৩', 'phone' => '০২৩৩৪৪৮৭৪৪০', 'email' => 'ae_pcd_chandpur@bitac.gov.bd'],
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
                    ['name' => 'মোঃ ওয়াহিদুল হক রাসেল', 'designation' => 'নির্বাহী প্রকৌশলী (শিল্প প্রকৌশল ও উৎপাদন নিয়ন্ত্রণ বিভাগ)',
                     'mobile' => '+৮৮০১৭৩২৭৭৯০৮০', 'email' => 'ae_ms_khulna@bitac.gov.bd'],
                    ['name' => 'মোঃ ওমর ইউসুফ', 'designation' => 'নির্বাহী প্রকৌশলী (যান্ত্রিক)',
                     'mobile' => '+৮৮০১৭২৩৬৭৪৯৭৪', 'email' => 'ae_ms_khulna@bitac.gov.bd'],
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
                    ['name' => 'মোঃ মামুনুর রশীদ', 'designation' => 'নির্বাহী প্রকৌশলী',
                     'mobile' => '+৮৮০১৭৪১৫৪৬২১০', 'email' => 'xen_bogura@bitac.gov.bd'],
                    ['name' => 'মোঃ আবু রায়হান লিটন', 'designation' => 'নির্বাহী প্রকৌশলী (প্রশিক্ষণ বিভাগ)',
                     'mobile' => '+৮৮০১৭৪৬৮৪৮৮০৬', 'email' => 'ae_ms_bogura@bitac.gov.bd'],
                    ['designation' => 'পরিচালক', 'email' => 'directorbogra@bitac.gov.bd'],
                    ['designation' => 'প্রশিক্ষণ বিভাগ', 'email' => 'trainingbogra@bitac.gov.bd'],
                ],
            ],
        ];

        foreach ($offices as $i => $o) {
            $contacts = $o['contacts'];
            unset($o['contacts']);

            $office = SiteOffice::firstOrCreate(['slug' => $o['slug']], $o + ['sort' => $i + 1, 'is_active' => true]);

            foreach ($contacts as $j => $c) {
                $this->upsertContact($office, $c, $j + 1);
            }
            $this->command?->line("  {$office->name}: " . $office->contacts()->count() . ' contacts, '
                . $office->contacts()->whereNotNull('mobile')->count() . ' with a mobile');
        }

        $this->command?->warn('Offices copied from bitac.gov.bd (2026-10-20). Officers are transferred — verify the people under Admin → Website → Offices.');
    }

    /**
     * Create the contact, or fill in only what an existing one still lacks.
     *
     * Found by NAME when there is one — so the same person is not added twice
     * after their post is re-worded — and otherwise by designation. A row that
     * already exists only ever gains values, never loses or changes one.
     */
    private function upsertContact(SiteOffice $office, array $c, int $sort): void
    {
        $existing = null;
        if (! empty($c['name'])) {
            $bare = $this->bareName($c['name']);
            $existing = $office->contacts()->get()->first(fn ($x) => $x->name && $this->bareName($x->name) === $bare);
        }
        $existing ??= $office->contacts()->where('designation', $c['designation'])->first();

        if (! $existing) {
            $office->contacts()->create($c + ['sort' => $sort, 'is_active' => true]);

            return;
        }

        $fill = [];
        foreach (['name', 'mobile', 'phone', 'email'] as $col) {
            if (! empty($c[$col]) && blank($existing->{$col})) {
                $fill[$col] = $c[$col];
            }
        }
        if ($fill) {
            $existing->update($fill);
        }
    }

    /** "জনাব মোঃ ওমর ফারুক" and "মোঃ ওমর ফারুক" are the same person. */
    private function bareName(string $name): string
    {
        return trim(preg_replace('/^(জনাব|জনাবা)\s*/u', '', $name));
    }
}
