<?php

if (!function_exists('format_taka')) {
    /**
     * Format amount in Bangladesh Taka (BDT) with lakh format.
     * Example: 1234567.89 → ৳12,34,567.89
     */
    function format_taka(float $amount, bool $showSymbol = true): string
    {
        $formatted = number_format_bd($amount);
        return $showSymbol ? '৳' . $formatted : $formatted;
    }
}

if (!function_exists('number_format_bd')) {
    /**
     * Format number in Bangladesh lakh format: 1,23,456.78
     */
    function number_format_bd(float $amount, int $decimals = 2): string
    {
        $amount   = round($amount, $decimals);
        $negative = $amount < 0;
        $amount   = abs($amount);

        $parts    = explode('.', number_format($amount, $decimals));
        $integer  = $parts[0];
        $decimal  = $parts[1] ?? str_repeat('0', $decimals);

        // Bangladesh format: last 3 digits, then groups of 2
        $integer  = str_replace(',', '', $integer);
        $len      = strlen($integer);
        if ($len <= 3) {
            $formatted = $integer;
        } else {
            $last3     = substr($integer, -3);
            $remaining = substr($integer, 0, -3);
            $groups    = [];
            while (strlen($remaining) > 2) {
                $groups[] = substr($remaining, -2);
                $remaining = substr($remaining, 0, -2);
            }
            if ($remaining !== '') {
                $groups[] = $remaining;
            }
            $groups   = array_reverse($groups);
            $formatted = implode(',', $groups) . ',' . $last3;
        }

        $result = $formatted . ($decimals > 0 ? '.' . $decimal : '');
        return $negative ? '-' . $result : $result;
    }
}
