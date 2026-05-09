<?php

namespace App\Services;

use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;

/**
 * Generates BITAC-style 5-digit job numbers (e.g., 37689, 37700, 37701).
 * Starts from 37700 to follow on from the client's actual job sequence
 * (their last paper jobs were 37556 and 37689).
 */
class JobNumberService
{
    private const STARTING_NUMBER = 37700;

    /**
     * Generate the next sequential job number atomically.
     */
    public static function next(): int
    {
        return DB::transaction(function () {
            $max = WorkOrder::lockForUpdate()->max('job_number');
            $next = $max ? $max + 1 : self::STARTING_NUMBER;
            return (int) $next;
        });
    }

    /**
     * Format a job number for display (zero-padded to 5 digits).
     */
    public static function format(?int $number): string
    {
        return $number ? str_pad((string) $number, 5, '0', STR_PAD_LEFT) : '—';
    }
}
