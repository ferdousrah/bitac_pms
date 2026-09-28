<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Bangladesh financial years — including the cycle change.
 *
 * ⚠️ The year is NOT a fixed July–June window. The cabinet has decided to move
 * the cycle to April–March from FY 2028–29, which makes **FY 2027–28 a nine
 * month year**:
 *
 *   up to 2026–27   1 July  – 30 June
 *   2027–28         1 July 2027 – 31 March 2028   (nine months, transitional)
 *   2028–29 onward  1 April – 31 March
 *
 * The three windows meet exactly, with no gap and no overlap, so every date
 * belongs to exactly one year.
 *
 * Never hardcode a July–June pair anywhere; ask this class. The 2028 change is
 * a cabinet decision rather than law yet, so if it shifts again, the two
 * constants below are the only things to move.
 */
class FinancialYear
{
    /** The last year that ran on the old July–June cycle (label `2026-27`). */
    private const LAST_JULY_START_YEAR = 2026;

    /** The first year that runs April–March (label `2028-29`). */
    private const FIRST_APRIL_START_YEAR = 2028;

    /**
     * The financial year a date falls in, as a `YYYY-YY` label (`2026-27`).
     */
    public static function forDate(DateTimeInterface|string|null $date = null): string
    {
        $d = $date instanceof DateTimeInterface
            ? CarbonImmutable::instance($d = \Carbon\Carbon::instance($date))
            : CarbonImmutable::parse($date ?? 'now');

        // The transitional year, spelled out because it obeys neither rule.
        if ($d->greaterThanOrEqualTo(CarbonImmutable::create(2027, 7, 1)->startOfDay())
            && $d->lessThan(CarbonImmutable::create(2028, 4, 1)->startOfDay())) {
            return self::label(2027);
        }

        // April–March from 2028-29 on.
        if ($d->greaterThanOrEqualTo(CarbonImmutable::create(self::FIRST_APRIL_START_YEAR, 4, 1)->startOfDay())) {
            return self::label($d->month >= 4 ? $d->year : $d->year - 1);
        }

        // July–June before that.
        return self::label($d->month >= 7 ? $d->year : $d->year - 1);
    }

    /**
     * First and last instant of a financial year.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function range(string $year): array
    {
        $start = self::startYear($year);

        // Transitional: July 2027 → March 2028, nine months.
        if ($start === 2027) {
            return [
                CarbonImmutable::create(2027, 7, 1)->startOfDay(),
                CarbonImmutable::create(2028, 3, 31)->endOfDay(),
            ];
        }

        if ($start >= self::FIRST_APRIL_START_YEAR) {
            return [
                CarbonImmutable::create($start, 4, 1)->startOfDay(),
                CarbonImmutable::create($start + 1, 3, 31)->endOfDay(),
            ];
        }

        return [
            CarbonImmutable::create($start, 7, 1)->startOfDay(),
            CarbonImmutable::create($start + 1, 6, 30)->endOfDay(),
        ];
    }

    /** The financial year we are in right now. */
    public static function current(): string
    {
        return self::forDate();
    }

    /**
     * A run of years around the current one, newest first — for a dropdown.
     */
    public static function options(int $back = 5, int $forward = 1): array
    {
        $now = self::startYear(self::current());
        $years = [];

        for ($y = $now + $forward; $y >= $now - $back; $y--) {
            $years[] = self::label($y);
        }

        return $years;
    }

    /** `2026-27` → `Jul 2026 – Jun 2027`, so the window is visible in the UI. */
    public static function describe(string $year): string
    {
        [$start, $end] = self::range($year);
        $text = $start->format('M Y') . ' – ' . $end->format('M Y');

        return self::startYear($year) === 2027 ? $text . ' (9 months)' : $text;
    }

    /** Is this a well-formed `YYYY-YY` label? */
    public static function isValid(string $year): bool
    {
        if (! preg_match('/^(\d{4})-(\d{2})$/', $year, $m)) return false;

        // The second half must be the next year's last two digits.
        return (int) $m[2] === ((int) $m[1] + 1) % 100;
    }

    public static function label(int $startYear): string
    {
        return $startYear . '-' . str_pad((string) (($startYear + 1) % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function startYear(string $year): int
    {
        return (int) substr($year, 0, 4);
    }
}
