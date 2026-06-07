<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            if (! Schema::hasColumn('gate_passes', 'party_name')) {
                $t->string('party_name', 200)->nullable()->after('direction');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            if (Schema::hasColumn('gate_passes', 'party_name')) $t->dropColumn('party_name');
        });
    }
};
