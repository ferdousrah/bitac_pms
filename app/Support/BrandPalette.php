<?php

namespace App\Support;

/**
 * The brand colour ramp, from one hex.
 *
 * ⚠️ **This is a deliberate mirror of `resources/js/lib/theme.ts`.** The JS
 * copy exists so the Branding admin screen can preview a colour live, without
 * a round trip; this copy exists so the server can write the variables into
 * every page — including the public website and the login screens, which never
 * mount `applyTheme`. Before this, the blade claimed "server-side theme
 * injection (prevents flash of default colors)" and injected nothing: the app
 * was themed by JS after paint, and the public site simply used the Tailwind
 * fallbacks, so **the website was a different colour from the application**.
 *
 * The two implementations must agree exactly. `BrandPaletteTest` runs the JS
 * one in node and compares every shade, so a change to one of them fails
 * rather than quietly making the admin's preview a lie.
 */
class BrandPalette
{
    /** Shade → target lightness, same table as theme.ts. */
    private const SHADE_LIGHTNESS = [
        50 => 97, 100 => 94, 200 => 86, 300 => 74, 400 => 60,
        500 => 48, 600 => 40, 700 => 32, 800 => 26, 900 => 21, 950 => 12,
    ];

    /** @return array<int,string> shade => "r g b" */
    public static function generate(string $hex): array
    {
        [$h, $s] = self::hexToHsl($hex);
        $palette = [];

        foreach (self::SHADE_LIGHTNESS as $shade => $lightness) {
            [$r, $g, $b] = self::hslToRgb($h, self::saturationFor($shade, $s), $lightness);
            $palette[$shade] = "$r $g $b";
        }

        return $palette;
    }

    /**
     * How saturated a shade is.
     *
     * ⚠️ The light end keeps most of the hue on purpose. It used to be cut to
     * 30%, which at 97% lightness is indistinguishable from grey — so every
     * `bg-brand-50` surface in the system (cards, chips, the admin's own tinted
     * bands) read as a grey box whatever brand colour was chosen. Capped, so a
     * fully saturated brand still gives a tint rather than a wash of colour.
     */
    private static function saturationFor(int $shade, float $s): float
    {
        return match (true) {
            $shade <= 100 => min($s * 0.85, 70),
            $shade <= 200 => min($s * 0.90, 80),
            $shade <= 300 => $s * 0.95,
            $shade >= 800 => min($s * 1.10, 100),
            default       => $s,
        };
    }

    /**
     * The `:root` block for the page shell.
     *
     * Returns '' when there is nothing to say, so the blade can drop the
     * `<style>` tag entirely rather than emit an empty one.
     */
    public static function cssVars(?string $primary, ?string $sidebar = null, ?string $accent = null): string
    {
        $lines = [];

        if ($primary && self::isHex($primary)) {
            foreach (self::generate($primary) as $shade => $rgb) {
                $lines[] = "--brand-$shade: $rgb;";
            }
            $lines[] = '--color-brand: ' . self::generate($primary)[500] . ';';
        }
        if ($sidebar && self::isHex($sidebar)) {
            $lines[] = '--sidebar-bg: ' . self::hexToRgbStr($sidebar) . ';';
        }
        if ($accent && self::isHex($accent)) {
            $lines[] = '--sidebar-accent: ' . self::hexToRgbStr($accent) . ';';
        }

        return $lines ? ':root{' . implode('', $lines) . '}' : '';
    }

    private static function isHex(string $hex): bool
    {
        return (bool) preg_match('/^#[0-9A-Fa-f]{6}$/', $hex);
    }

    public static function hexToRgbStr(string $hex): string
    {
        return implode(' ', [
            hexdec(substr($hex, 1, 2)),
            hexdec(substr($hex, 3, 2)),
            hexdec(substr($hex, 5, 2)),
        ]);
    }

    /** @return array{0:float,1:float,2:float} hue 0-360, sat 0-100, lightness 0-100 */
    private static function hexToHsl(string $hex): array
    {
        $r = hexdec(substr($hex, 1, 2)) / 255;
        $g = hexdec(substr($hex, 3, 2)) / 255;
        $b = hexdec(substr($hex, 5, 2)) / 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $h = 0.0;
        $s = 0.0;
        $l = ($max + $min) / 2;

        if ($max !== $min) {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
            $h = match ($max) {
                $r => (($g - $b) / $d + ($g < $b ? 6 : 0)) / 6,
                $g => (($b - $r) / $d + 2) / 6,
                default => (($r - $g) / $d + 4) / 6,
            };
        }

        return [$h * 360, $s * 100, $l * 100];
    }

    /** @return array{0:int,1:int,2:int} */
    private static function hslToRgb(float $h, float $s, float $l): array
    {
        $h /= 360;
        $s /= 100;
        $l /= 100;

        if ($s == 0.0) {
            $v = (int) round($l * 255);

            return [$v, $v, $v];
        }

        $hue2rgb = function (float $p, float $q, float $t): float {
            if ($t < 0) $t += 1;
            if ($t > 1) $t -= 1;
            if ($t < 1 / 6) return $p + ($q - $p) * 6 * $t;
            if ($t < 1 / 2) return $q;
            if ($t < 2 / 3) return $p + ($q - $p) * (2 / 3 - $t) * 6;

            return $p;
        };

        $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        $p = 2 * $l - $q;

        return [
            (int) round($hue2rgb($p, $q, $h + 1 / 3) * 255),
            (int) round($hue2rgb($p, $q, $h) * 255),
            (int) round($hue2rgb($p, $q, $h - 1 / 3) * 255),
        ];
    }
}
