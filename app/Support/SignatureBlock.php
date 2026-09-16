<?php

namespace App\Support;

use App\Models\User;

/**
 * The signature block as it appears on every BITAC PDF.
 *
 * ⚠️ **A signature image is the WHOLE block.** BITAC officers sign with a
 * scanned stamp that already carries, under the pen stroke, their name in
 * Bangla, designation, centre and contacts. So when there is an image we print
 * the image and nothing else — printing the name/designation underneath as
 * well duplicated every line.
 *
 * When there is NO image (nobody has signed yet, or the signatory never
 * uploaded one) we fall back to the typed details, otherwise an unsigned
 * document would not say who it is for. Role labels ("Approved By", "Issued
 * By") are NOT signatory details and always print.
 *
 * Every PDF goes through here — don't hand-roll a signature block again.
 */
class SignatureBlock
{
    /** Signatory ink — the purple used across cost estimates, quotations and letters. */
    public const INK = '#a349a4';

    /**
     * @param  string|null  $imagePath  Absolute local path (mPDF needs local).
     * @param  array<int,string>  $lines  Typed fallback lines, already escaped,
     *                                    in print order. Ignored when an image
     *                                    is present.
     * @param  float  $blankHeightPt   Height of the blank space that stands in
     *                                 for the signature when there is no image.
     * @param  float  $imageMaxWidthPt Width the image is scaled to fit.
     */
    public static function html(
        ?string $imagePath,
        array $lines = [],
        float $blankHeightPt = 46,
        float $imageMaxWidthPt = 170,
        string $align = 'center',
        string $ink = self::INK,
    ): string {
        if ($imagePath && is_file($imagePath)) {
            // ⚠️ Constrain the WIDTH only, never the height.
            //
            // The image is a whole signature block — a pen stroke plus four or
            // five lines of name/designation/contacts. Pinning it to a fixed
            // height squeezed all of that into ~17mm and the writing came out
            // too small to read. Width-only lets it keep its own proportions
            // and fill the column the way the printed original does.
            return '<div style="text-align: ' . $align . ';">'
                . '<img src="' . $imagePath . '" style="width: ' . $imageMaxWidthPt . 'pt;" />'
                . '</div>';
        }

        // No image — keep the space the signature would have taken so the
        // layout doesn't jump, then name the signatory in text.
        $html = '<div style="height: ' . $blankHeightPt . 'pt;"></div>';

        foreach (array_values(array_filter($lines, fn ($l) => trim((string) $l) !== '')) as $i => $line) {
            $html .= '<div style="text-align: ' . $align . '; font-size: ' . ($i === 0 ? '10pt' : '9pt')
                . '; color: ' . $ink . '; line-height: 1.35;">' . $line . '</div>';
        }

        return $html;
    }

    /**
     * The typed fallback lines for a user, in the order BITAC prints them.
     * Callers pass the result to html() as $lines.
     *
     * @param  array{designation?:string,center?:string,email?:string,phone?:string}  $fallbacks
     */
    public static function linesFor(?User $user, array $fallbacks = [], string $language = 'bn'): array
    {
        if (!$user) return [];

        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = $language !== 'en';

        $designation = $user->designation ?: ($fallbacks['designation'] ?? '');
        $center      = $user->center?->name ?: ($fallbacks['center'] ?? '');
        $email       = $user->email ?: ($fallbacks['email'] ?? '');
        $phone       = $user->phone ?: ($fallbacks['phone'] ?? '');

        $lines = [
            '(' . $esc($user->name) . ')',
            $esc($designation),
            $esc($center) . ($center !== '' ? ($isBn ? ' ।' : '.') : ''),
        ];

        if ($email !== '') {
            $lines[] = ($isBn ? 'ই-মেইলঃ ' : 'Email: ') . '<u>' . $esc($email) . '</u>';
        }
        if ($phone !== '') {
            $lines[] = ($isBn ? 'ফোনঃ ' : 'Phone: ') . $esc($isBn ? BanglaDigits::from($phone) : $phone);
        }

        return $lines;
    }
}
