<?php

namespace Database\Seeders;

use App\Models\Partner;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Sample rows for the public site's Collaborators & partners wall.
 *
 * ⚠️ **The logos are PLACEHOLDERS, not anybody's real emblem.** Each one is
 * drawn here — a coloured disc with the initials and the abbreviation beside
 * it — so the section can be seen working before BITAC has the real artwork.
 * Reproducing a government body's actual crest would be the wrong thing to
 * ship, and these are obviously stand-ins. Replace each at
 * Admin → Website → Partners.
 *
 * ⚠️ A **seeder**, not a migration: this is demo content somebody will delete,
 * and a migration would put it back on every fresh deploy. The service lines
 * are seeded in their migration because those are BITAC's real wording.
 *
 * Idempotent — a partner that is already there by name is left alone, logo
 * included, so re-running cannot overwrite real artwork with a placeholder.
 *
 *   php artisan db:seed --class=PartnerSampleSeeder
 */
class PartnerSampleSeeder extends Seeder
{
    private const DIR = 'website/partners';

    /** name, abbreviation, kind, note, website, disc colour. */
    private const SAMPLES = [
        ['Ministry of Industries', 'MoI', 'partner', 'Parent ministry', 'https://moind.gov.bd', [91, 45, 144]],
        ['Bangladesh Railway', 'BR', 'partner', 'Rolling stock & spares', 'https://railway.gov.bd', [21, 94, 117]],
        ['Bangladesh Power Development Board', 'BPDB', 'partner', 'Plant components', 'https://bpdb.gov.bd', [180, 83, 9]],
        ['Bangladesh Water Development Board', 'BWDB', 'partner', 'Pump & gate works', 'https://bwdb.gov.bd', [30, 64, 175]],
        ['Petrobangla', 'PB', 'partner', 'Field equipment', 'https://petrobangla.org.bd', [4, 120, 87]],
        ['Bangladesh Sugar & Food Industries Corporation', 'BSFIC', 'partner', 'Mill overhaul', 'https://bsfic.gov.bd', [159, 18, 57]],
        ['Bangladesh Standards & Testing Institution', 'BSTI', 'collaborator', 'Standards & testing', 'https://bsti.gov.bd', [67, 56, 202]],
        ['Bangladesh Small & Cottage Industries Corporation', 'BSCIC', 'collaborator', 'Industrial training', 'https://bscic.gov.bd', [146, 64, 14]],
        ['Bangladesh University of Engineering & Technology', 'BUET', 'collaborator', 'Research & development', 'https://buet.ac.bd', [15, 118, 110]],
        ['National Skills Development Authority', 'NSDA', 'collaborator', 'Skills certification', 'https://nsda.gov.bd', [120, 53, 15]],
    ];

    public function run(): void
    {
        foreach (self::SAMPLES as $i => [$name, $abbr, $kind, $note, $url, $rgb]) {
            if (Partner::where('name', $name)->exists()) {
                $this->command?->line("  skipped (already there): {$name}");
                continue;
            }

            Partner::create([
                'name'      => $name,
                'kind'      => $kind,
                'note'      => $note,
                'url'       => $url,
                'logo_path' => $this->drawLogo($abbr, $rgb),
                'sort'      => $i + 1,
                'is_active' => true,
            ]);
        }

        $this->command?->info('Partner samples ready — the logos are placeholders, replace them under Admin → Website → Partners.');
    }

    /**
     * Draw a stand-in mark: a coloured disc with the initials, the
     * abbreviation beside it.
     *
     * ⚠️ Transparent background, because the wall sets every logo on white
     * and then greys it — a white rectangle behind the mark would show as a
     * block against the card.
     */
    private function drawLogo(string $abbr, array $rgb): string
    {
        $w = 460; $h = 160;
        $im = imagecreatetruecolor($w, $h);
        imagesavealpha($im, true);
        imagealphablending($im, false);
        imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
        imagealphablending($im, true);

        $brand = imagecolorallocate($im, ...$rgb);
        $white = imagecolorallocate($im, 255, 255, 255);
        $ink   = imagecolorallocate($im, 30, 41, 59);

        // The disc, drawn at 4× and scaled down — GD has no antialiasing on a
        // filled ellipse, and a jagged circle is the one thing that reads as
        // broken rather than plain.
        $d = 128;
        $big = imagecreatetruecolor($d * 4, $d * 4);
        imagesavealpha($big, true);
        imagealphablending($big, false);
        imagefill($big, 0, 0, imagecolorallocatealpha($big, 0, 0, 0, 127));
        imagealphablending($big, true);
        imagefilledellipse($big, $d * 2, $d * 2, $d * 4, $d * 4, imagecolorallocate($big, ...$rgb));
        imagecopyresampled($im, $big, 16, ($h - $d) / 2, 0, 0, $d, $d, $d * 4, $d * 4);
        imagedestroy($big);

        $font = public_path('fonts/Tinos-Bold.ttf');

        // Initials inside the disc — at most two letters, or they will not fit.
        $initials = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $abbr), 0, 2));
        $this->centreText($im, $font, 40, $white, 16 + $d / 2, ($h / 2) + 14, $initials);

        // The abbreviation beside it.
        imagettftext($im, 34, 0, 16 + $d + 22, ($h / 2) + 12, $ink, $font, $abbr);

        $path = self::DIR . '/sample-' . Str::slug($abbr) . '.png';
        ob_start();
        imagepng($im);
        Storage::disk('public')->put($path, ob_get_clean());
        imagedestroy($im);

        return $path;
    }

    private function centreText($im, string $font, int $size, int $colour, float $cx, float $cy, string $text): void
    {
        $box = imagettfbbox($size, 0, $font, $text);
        $width = $box[2] - $box[0];
        imagettftext($im, $size, 0, (int) ($cx - $width / 2), (int) $cy, $colour, $font, $text);
    }
}
