<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who took the picture, and under what licence.
 *
 * ⚠️ Not decoration. Most freely licensed photographs and footage (CC BY,
 * CC BY-SA) are licensed ON CONDITION that the author and licence are shown
 * where the work appears. A government website that drops the credit is
 * using the photo without permission, however free it looked. BITAC's own
 * photographs simply leave this blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hero_slides', function (Blueprint $table) {
            if (! Schema::hasColumn('hero_slides', 'credit')) {
                $table->string('credit', 255)->nullable()->after('cta_url');
            }
            if (! Schema::hasColumn('hero_slides', 'credit_url')) {
                $table->string('credit_url', 500)->nullable()->after('credit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hero_slides', function (Blueprint $table) {
            foreach (['credit_url', 'credit'] as $col) {
                if (Schema::hasColumn('hero_slides', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
