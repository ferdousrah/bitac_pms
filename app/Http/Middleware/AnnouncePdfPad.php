<?php

namespace App\Http\Middleware;

use App\Services\BitacLetterhead;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tells the browser which letterhead (pad) a PDF was printed on.
 *
 * Every PDF can be printed on the Bangla or the English pad (BITAC,
 * 2026-10-20) — `BitacLetterhead::render()` honours `?pad=bn|en` on any
 * request. The shared PDF popup needs to know two things to offer the
 * switch: that this PDF HAS a pad at all (notes, envelopes and মূসক ৬.৩ are
 * plain paper and must not show it), and which one it is on. The letterhead
 * records what it did; this puts it on the response:
 *
 *   X-Pdf-Pad          the pad used (bn | en)
 *   X-Pdf-Pad-Default  the pad the document prints on when nobody chooses
 */
class AnnouncePdfPad
{
    public function handle(Request $request, Closure $next): Response
    {
        // Nothing carried over from an earlier request in the same process.
        app()->forgetInstance(BitacLetterhead::PAD_USED);

        $response = $next($request);

        if (app()->bound(BitacLetterhead::PAD_USED)) {
            $pad = app(BitacLetterhead::PAD_USED);
            $response->headers->set('X-Pdf-Pad', $pad['used']);
            $response->headers->set('X-Pdf-Pad-Default', $pad['default']);
        }

        return $response;
    }
}
