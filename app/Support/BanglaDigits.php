<?php

namespace App\Support;

/**
 * Western ↔ Bangla numerals for printed documents.
 *
 * BITAC's official paperwork sets numbers in Bangla digits wherever the
 * surrounding text is Bangla — memo numbers, dates, the numbered terms on a
 * quotation. Keep this the single place that knows the mapping.
 *
 * ⚠️ Bangla digits are Bengali-script codepoints, so whatever prints them
 * needs the Bangla face (`font-family: nikosh`) — Tinos has no glyph for ০-৯
 * and mPDF will fall back mid-line.
 */
class BanglaDigits
{
    private const MAP = [
        '0' => '০', '1' => '১', '2' => '২', '3' => '৩', '4' => '৪',
        '5' => '৫', '6' => '৬', '7' => '৭', '8' => '৮', '9' => '৯',
    ];

    /** Every 0-9 in the value becomes its Bangla counterpart. */
    public static function from(string|int|float|null $value): string
    {
        return strtr((string) $value, self::MAP);
    }

    /** The reverse — Bangla digits back to 0-9 (for parsing typed input). */
    public static function toWestern(string|null $value): string
    {
        return strtr((string) $value, array_flip(self::MAP));
    }
}
