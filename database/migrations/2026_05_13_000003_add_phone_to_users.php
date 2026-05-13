<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            // Used on outgoing letter signature blocks (e.g. "ফোনঃ 01914-894085").
            // Optional — falls back to the center's phone if not set.
            $t->string('phone', 40)->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('phone');
        });
    }
};
