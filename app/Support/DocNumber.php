<?php

namespace App\Support;

use App\Models\Center;
use Illuminate\Support\Facades\DB;

/**
 * Document numbers that carry their centre — `WO-DHK-2026-0042`,
 * `WO-CTG-2026-0001` (BITAC, 2026-10-26: one system, several centres).
 *
 * ⚠️ Why this exists: the old generators counted rows THROUGH CenterScope, so
 * each centre counted only its own — the second centre's first work order
 * came out as `WO-2026-0001`, which Dhaka already had, and the unique index
 * refused the save. With the centre's code in the number, each centre has its
 * own series and two can never meet.
 *
 * Each centre continues its OWN count for the year, reading its numbers in the
 * old form (`WO-2026-0041`) as well as the new one, so Dhaka's series carries
 * straight on (`…-0041` → `WO-DHK-2026-0042`) and nothing already issued
 * changes. It reads with DB::table, so no global scope can hide a row.
 */
class DocNumber
{
    /**
     * @param string   $table    e.g. 'work_orders'
     * @param string   $column   e.g. 'wo_number'
     * @param string   $prefix   e.g. 'WO'
     * @param int|null $centerId the document's centre; null = the current one
     */
    public static function next(string $table, string $column, string $prefix, ?int $centerId = null, int $pad = 4): string
    {
        $centerId ??= self::currentCentreId();
        $code = self::code($centerId);
        $year = now()->format('Y');

        $existing = DB::table($table)
            ->where('center_id', $centerId)
            ->where(fn ($q) => $q->where($column, 'like', "{$prefix}-{$code}-{$year}-%")
                ->orWhere($column, 'like', "{$prefix}-{$year}-%"))
            ->pluck($column);

        $max = 0;
        foreach ($existing as $no) {
            if (preg_match('/-(\d+)$/', (string) $no, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return sprintf('%s-%s-%s-%0' . $pad . 'd', $prefix, $code, $year, $max + 1);
    }

    /** The centre a new document belongs to when the caller does not say. */
    public static function currentCentreId(): int
    {
        return (app()->bound('current_center_id') ? app('current_center_id') : null)
            ?: auth()->user()?->center_id
            ?: Center::defaultId();
    }

    /** The centre's short code (DHK, CTG…), upper-case; the id if none is set. */
    public static function code(int $centerId): string
    {
        $code = strtoupper(trim((string) Center::whereKey($centerId)->value('code')));

        return $code !== '' ? preg_replace('/[^A-Z0-9]/', '', $code) : 'C' . $centerId;
    }
}
