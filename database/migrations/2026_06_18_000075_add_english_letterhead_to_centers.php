<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The English letterhead (BITAC, 2026-10-20): the Bangla letterhead stays as it
 * is; English documents get an English one, transcribed from BITAC's own
 * printed English pad (the "Training Details" sheet to Biman, 20.09.2026):
 *
 *   Bangladesh Industrial Technical Assistance Center (BITAC)
 *   Ministry of Industries
 *   Government of the People's Republic of Bangladesh
 *   116 (kha), Tejgaon Industrial Area, Dhaka-1208.
 *   Telephone: 02-55030046, 02-55030057  Fax: 02-55030049  Website: www.bitac.gov.bd
 *
 * ⚠️ Separate `*_en` columns, NOT the existing `name` / `address` / `phone`:
 * `name` is the short internal name the app uses everywhere ("BITAC Dhaka" in
 * the centre switcher) and printing it as the letterhead title is exactly what
 * the old English header did wrong. The letterhead is a formal document, the
 * same text a person would find on the paper — so it gets its own fields,
 * like the Bangla ones already have.
 *
 * Only blanks are filled, so a re-run never overwrites what an admin typed.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'name_en'       => 200,
        'ministry_en'   => 200,
        'government_en' => 200,
        'address_en'    => 300,
        'phone_en'      => 120,
        'fax_en'        => 120,
    ];

    public function up(): void
    {
        Schema::table('centers', function (Blueprint $table) {
            foreach (self::COLUMNS as $col => $len) {
                if (! Schema::hasColumn('centers', $col)) {
                    $table->string($col, $len)->nullable();
                }
            }
        });

        $fill = function ($id, array $values) {
            foreach ($values as $col => $value) {
                DB::table('centers')->where('id', $id)
                    ->where(fn ($q) => $q->whereNull($col)->orWhere($col, ''))
                    ->update([$col => $value]);
            }
        };

        foreach (DB::table('centers')->get(['id', 'code', 'address']) as $c) {
            // What every BITAC centre's pad says.
            $values = [
                'name_en'       => 'Bangladesh Industrial Technical Assistance Center (BITAC)',
                'ministry_en'   => 'Ministry of Industries',
                'government_en' => "Government of the People's Republic of Bangladesh",
            ];

            if (strtoupper((string) $c->code) === 'DHK') {
                // Dhaka — exactly as the printed English pad reads.
                $values += [
                    'address_en' => '116 (kha), Tejgaon Industrial Area, Dhaka-1208.',
                    'phone_en'   => '02-55030046, 02-55030057',
                    'fax_en'     => '02-55030049',
                ];
            } elseif ($c->address) {
                $values['address_en'] = $c->address;
            }

            $fill($c->id, $values);
        }
    }

    public function down(): void
    {
        Schema::table('centers', function (Blueprint $table) {
            foreach (array_keys(self::COLUMNS) as $col) {
                if (Schema::hasColumn('centers', $col)) $table->dropColumn($col);
            }
        });
    }
};
