<?php

namespace Database\Seeders;

use App\Models\NewsPost;
use Illuminate\Database\Seeder;

/**
 * Sample posts so the home page's News & Events section can be seen working.
 *
 * ⚠️ Chosen so that nothing here is a false public statement if someone forgets
 * to delete it. The three stories describe this system itself — the website,
 * the customer portal, job tracking — which are true. The two EVENTS are the
 * only invented content (a course and an open day, with dates a few weeks
 * out), so they are the ones to edit or delete first, and the seeder says so.
 *
 * ⚠️ **No tender notices.** A tender is a legal invitation; a made-up one left
 * live on a government site could have real suppliers preparing bids for
 * something that does not exist.
 *
 * A seeder, not a migration — demo content somebody will delete, and a
 * migration would put it back on every deploy. Keyed on the title, so a
 * re-run never duplicates and never overwrites a post someone has edited.
 *
 *   php artisan db:seed --class=NewsSampleSeeder
 */
class NewsSampleSeeder extends Seeder
{
    public function run(): void
    {
        $posts = [
            [
                'kind'    => 'news',
                'title'   => "BITAC's new website and customer portal are live",
                'excerpt' => 'Our services, products, clients and news now in one place — with a portal where clients follow their own jobs.',
                'body'    => "BITAC's public website now brings together what the centre does — import-substitute manufacturing, industrial training, testing and research — alongside the products our shops have made and the organisations we work with.\n\nAlongside it, clients have a portal of their own: quotations, work orders, deliveries and bills for their jobs, available whenever they need them.",
                'days_ago' => 2,
            ],
            [
                'kind'    => 'notice',
                'title'   => 'Clients can now track jobs, quotations and bills online',
                'excerpt' => 'Sign in to the customer portal to see where your work stands, from quotation to delivery.',
                'body'    => "Clients with an account can sign in to the customer portal to see each of their jobs as it moves through BITAC — the quotation, the work order, production, inspection and delivery — and the bills raised against them, including what has been paid and what is due.\n\nTo request an account, contact the centre handling your work.",
                'days_ago' => 6,
            ],
            [
                'kind'    => 'news',
                'title'   => 'Production now tracked from enquiry to delivery',
                'excerpt' => 'Every job is costed part by part, routed through the shops and inspected before it leaves — and now recorded at each step.',
                'body'    => "BITAC's production management now follows a job through its whole life: the enquiry and the costing behind its quotation, the work order, planning and routing through the shops, output logged as it is made, quality inspection, and finally delivery and billing.\n\nFor clients, that means a clearer answer to the question that matters most — where is my job?",
                'days_ago' => 11,
            ],
            [
                'kind'       => 'event',
                'title'      => 'Industrial training: CNC machining fundamentals',
                'excerpt'    => 'A hands-on course on CNC set-up, programming and operation, taught on working shop-floor machines.',
                'body'       => "A practical course for technicians from industry and government, covering CNC machine set-up, part programming, tooling and safe operation.\n\nSessions are held on BITAC's own machines. Contact the training section for seats and fees.",
                'location'   => 'BITAC, Tejgaon, Dhaka',
                'event_in'   => 24,
                'days_ago'   => 3,
            ],
            [
                'kind'       => 'event',
                'title'      => 'Open day for industry: see the shops at work',
                'excerpt'    => 'Walk the machining, fabrication and heat-treatment shops and talk to the engineers about your parts.',
                'body'       => "Manufacturers, maintenance engineers and procurement officers are welcome to see BITAC's shops at work and discuss import-substitute parts with our engineers.\n\nBring a drawing or a sample if you have one.",
                'location'   => 'BITAC, Tejgaon, Dhaka',
                'event_in'   => 45,
                'days_ago'   => 4,
            ],
        ];

        foreach ($posts as $i => $p) {
            if (NewsPost::where('title', $p['title'])->exists()) {
                $this->command?->line("  skipped (already there): {$p['title']}");
                continue;
            }

            NewsPost::create([
                'title'        => $p['title'],
                'slug'         => NewsPost::slugFor($p['title']),
                'kind'         => $p['kind'],
                'excerpt'      => $p['excerpt'],
                'body'         => $p['body'],
                'location'     => $p['location'] ?? null,
                'event_date'   => isset($p['event_in']) ? today()->addDays($p['event_in']) : null,
                'published_at' => now()->subDays($p['days_ago']),
                'is_published' => true,
                'sort'         => $i,
            ]);
        }

        $this->command?->warn('Sample news ready. The two EVENTS have invented dates — edit or delete them under Admin → Website → News & Events.');
    }
}
