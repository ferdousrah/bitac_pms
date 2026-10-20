<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A hero slide can be a YouTube video (BITAC).
 *
 * ⚠️ A YouTube slide cannot tell us when it has finished — that needs the
 * IFrame Player API, a whole script and a state machine, for one number. So
 * the slide carries how long to hold, which an image slide can use too.
 *
 * `hero_slides.kind` is already `varchar(10)`, so 'youtube' needs no widening.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('hero_slides', 'hold_seconds')) {
            Schema::table('hero_slides', function (Blueprint $table) {
                $table->unsignedSmallInteger('hold_seconds')->nullable()->after('video_url');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('hero_slides', 'hold_seconds')) {
            Schema::table('hero_slides', function (Blueprint $table) {
                $table->dropColumn('hold_seconds');
            });
        }
    }
};
