<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Move the theme from amber to BITAC's violet.
 *
 * The brand colour is a stored setting, so changing the code defaults alone
 * would have left this database on `#f59e0b` and the screen still yellow.
 *
 * ⚠️ **Guarded to the colours nobody chose on purpose.** It only rewrites a
 * value that is still one of the shipped oranges/ambers — if somebody has since
 * picked a colour of their own in Admin → Branding, it is left alone. A
 * migration that stamps on a deliberate choice is worse than one that does
 * nothing.
 *
 * ⚠️ `SettingService` caches the whole table forever, so the cache has to be
 * dropped here or the old colour survives the deploy.
 */
return new class extends Migration
{
    /** The violet on BITAC's own letterhead (`BitacLetterhead::TITLE_INK`). */
    private const PRIMARY = '#5b2d90';
    private const SIDEBAR = '#1b1233';
    private const ACCENT  = '#2b1d4d';

    /** Values this project has shipped as the default at one time or another. */
    private const SHIPPED = [
        'primary_color'  => ['#ff7a0f', '#f59e0b'],
        'sidebar_color'  => ['#0f172a'],
        'sidebar_accent' => ['#1e293b'],
    ];

    private const WANT = [
        'primary_color'  => self::PRIMARY,
        'sidebar_color'  => self::SIDEBAR,
        'sidebar_accent' => self::ACCENT,
    ];

    public function up(): void
    {
        foreach (self::WANT as $key => $value) {
            $row = DB::table('settings')->where('key', $key)->first();

            if (! $row) {
                DB::table('settings')->insert([
                    'key' => $key, 'value' => $value,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                continue;
            }

            if (in_array(strtolower((string) $row->value), self::SHIPPED[$key], true)) {
                DB::table('settings')->where('key', $key)
                    ->update(['value' => $value, 'updated_at' => now()]);
            }
        }

        // The chatbot's accent is its own setting; same rule.
        $chat = DB::table('settings')->where('key', 'chatbot.primary_color')->first();
        if ($chat && in_array(strtolower((string) $chat->value), ['#ff7a0f', '#f59e0b'], true)) {
            DB::table('settings')->where('key', 'chatbot.primary_color')
                ->update(['value' => self::PRIMARY, 'updated_at' => now()]);
        }

        Cache::forget('app_settings');
    }

    public function down(): void
    {
        // Back to the amber this database was actually on, not to the original
        // orange — rolling back should undo this change, not a older one.
        $back = [
            'primary_color'  => '#f59e0b',
            'sidebar_color'  => '#0f172a',
            'sidebar_accent' => '#1e293b',
        ];

        foreach ($back as $key => $value) {
            DB::table('settings')->where('key', $key)
                ->where('value', self::WANT[$key])
                ->update(['value' => $value, 'updated_at' => now()]);
        }

        Cache::forget('app_settings');
    }
};
