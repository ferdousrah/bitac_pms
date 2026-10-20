<?php

namespace Database\Seeders;

use App\Models\HeroSlide;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Sample slides for the home page hero, so the slider can be seen working.
 *
 * ⚠️ **These are NOT BITAC's photographs.** BITAC has supplied none yet, so
 * these are freely licensed industrial photos and footage from Wikimedia
 * Commons, chosen to match its four service lines. Replace them with BITAC's
 * own pictures at Admin → Website → Hero slider as soon as there are any.
 *
 * ⚠️ **The credit is fetched, never typed.** Each file's author and licence
 * come from the Commons API at download time and are stored on the slide,
 * because most of these licences (CC BY, CC BY-SA) are granted ON CONDITION
 * that the credit is shown where the work appears. A hand-typed credit is the
 * one that ends up wrong.
 *
 * ⚠️ **Downloaded at seed time, not committed** — a few megabytes of stock
 * media do not belong in the repository. It needs the internet; without it
 * each slide is skipped with a warning and nothing half-made is left behind.
 *
 * Idempotent and keyed on the slide's title, so a re-run never duplicates
 * and never overwrites a slide someone has edited.
 *
 *   php artisan db:seed --class=HeroSampleSeeder
 */
class HeroSampleSeeder extends Seeder
{
    private const API = 'https://commons.wikimedia.org/w/api.php';

    /** Wikimedia asks every client to identify itself. */
    private const UA = 'BITAC-PMS-sample-seeder/1.0 (https://bitac.gov.bd; demo content)';

    /** Files written for the slide in progress, so a failure can take them back. */
    private array $stored = [];

    private const SLIDES = [
        [
            'file'      => 'File:CNC lathe.webm',
            'kind'      => 'video',
            'title'     => 'Precision machining for national industry',
            'subtitle'  => 'From a single spare part to a production run, our shops machine to the tolerance your drawing asks for.',
            'cta_label' => 'Request a quotation',
            'cta_url'   => '/portfolio/contact',
        ],
        [
            'file'      => 'File:Lathe Center Drilling.jpg',
            'kind'      => 'image',
            'title'     => 'Made in Bangladesh, instead of imported',
            'subtitle'  => 'Spares and components turned, milled and finished to drawing — for Railway, power, sugar and private industry.',
            'cta_label' => 'Our services',
            'cta_url'   => '/portfolio/services',
        ],
        [
            'file'      => 'File:Cortadora de metal.JPG',
            'kind'      => 'image',
            'title'     => 'Fabrication and heavy repair',
            'subtitle'  => 'Cutting, welding and rebuilding the equipment that keeps the nation\'s plants running.',
            'cta_label' => 'See our work',
            'cta_url'   => '/portfolio/products',
        ],
        [
            'file'      => 'File:Mechanical engineering workshop at Arusha Technical College, Tanzania.jpg',
            'kind'      => 'image',
            'title'     => 'Skills for industry',
            'subtitle'  => 'Hands-on industrial training on working shop-floor machines, for technicians from government and private industry.',
            'cta_label' => 'Training & services',
            'cta_url'   => '/portfolio/services',
        ],
    ];

    public function run(): void
    {
        foreach (self::SLIDES as $i => $s) {
            if (HeroSlide::where('title', $s['title'])->exists()) {
                $this->command?->line("  skipped (already there): {$s['title']}");
                continue;
            }

            $this->stored = [];
            try {
                $info = $this->describe($s['file'], $s['kind']);
                $paths = $s['kind'] === 'video' ? $this->fetchVideo($info) : ['image_path' => $this->fetchImage($info)];
            } catch (\Throwable $e) {
                // A video whose poster failed would otherwise leave the clip
                // orphaned in storage with no slide pointing at it.
                Storage::disk('public')->delete($this->stored);
                $this->command?->warn("  could not fetch {$s['file']}: {$e->getMessage()}");
                continue;
            }

            HeroSlide::create($paths + [
                'kind'       => $s['kind'],
                'title'      => $s['title'],
                'subtitle'   => $s['subtitle'],
                'cta_label'  => $s['cta_label'],
                'cta_url'    => $s['cta_url'],
                'credit'     => $this->creditLine($info, $s['kind']),
                'credit_url' => $info['page'],
                'sort'       => $i + 1,
                'is_active'  => true,
            ]);
            $this->command?->line("  added: {$s['title']}");
        }

        $this->command?->warn('Sample hero slides are stock media from Wikimedia Commons, credited on the page. Replace them with BITAC\'s own photographs under Admin → Website → Hero slider.');
    }

    /** Ask Commons for the file's URLs, author and licence. */
    private function describe(string $file, string $kind): array
    {
        $prop = $kind === 'video' ? 'videoinfo' : 'imageinfo';
        $key  = $kind === 'video' ? 'vi' : 'ii';

        $res = Http::withHeaders(['User-Agent' => self::UA])->timeout(40)->get(self::API, [
            'action' => 'query', 'titles' => $file, 'prop' => $prop, 'format' => 'json',
            $key . 'prop'     => 'url|size|mime|extmetadata',
            // 1920 is one of the widths Wikimedia serves; arbitrary widths are refused.
            $key . 'urlwidth' => $kind === 'video' ? 1280 : 1920,
        ])->throw()->json();

        $page = collect($res['query']['pages'] ?? [])->first();
        $meta = $page[$prop][0] ?? null;
        if (! $meta) {
            throw new \RuntimeException('not found on Commons');
        }

        $m = $meta['extmetadata'] ?? [];
        $clean = fn ($v) => trim(html_entity_decode(strip_tags((string) $v)));

        return [
            'url'     => $meta['url'],
            'thumb'   => $meta['thumburl'] ?? null,
            'page'    => $meta['descriptionurl'],
            'artist'  => $clean($m['Artist']['value'] ?? '') ?: 'Unknown',
            'licence' => $clean($m['LicenseShortName']['value'] ?? ''),
        ];
    }

    /** "Photo: David English · CC BY-SA 4.0 · Wikimedia Commons" */
    private function creditLine(array $info, string $kind): string
    {
        return ($kind === 'video' ? 'Video: ' : 'Photo: ')
            . Str::limit($info['artist'], 60, '…')
            . ($info['licence'] ? ' · ' . $info['licence'] : '')
            . ' · Wikimedia Commons';
    }

    private function fetchImage(array $info): string
    {
        return $this->store($info['thumb'] ?: $info['url'], 'jpg');
    }

    /** The clip itself, plus a still from it as the poster. */
    private function fetchVideo(array $info): array
    {
        $ext = strtolower(pathinfo(parse_url($info['url'], PHP_URL_PATH), PATHINFO_EXTENSION)) ?: 'webm';

        return [
            'video_path'  => $this->store($info['url'], $ext),
            // The still shown while the clip loads, and on phones that will not
            // autoplay at all.
            'poster_path' => $info['thumb'] ? $this->store($info['thumb'], 'jpg') : null,
        ];
    }

    private function store(string $url, string $ext): string
    {
        $bytes = Http::withHeaders(['User-Agent' => self::UA])->timeout(120)->get($url)->throw()->body();
        if (strlen($bytes) < 1024) {
            throw new \RuntimeException('download looked empty');
        }

        $path = 'website/hero/sample-' . Str::random(10) . '.' . $ext;
        Storage::disk('public')->put($path, $bytes);
        $this->stored[] = $path;

        return $path;
    }
}
