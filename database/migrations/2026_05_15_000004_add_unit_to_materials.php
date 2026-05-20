<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $t) {
            // Most materials are priced per kg (see rate_per_kg) so kg is the
            // safe default. Admin can override for non-weight materials like
            // chemicals (L), fasteners (pcs), films (m²), etc.
            $t->string('unit', 20)->default('kg')->after('category');
        });

        // Existing rows already have rate_per_kg, so set their unit to kg.
        DB::table('materials')->update(['unit' => 'kg']);
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $t) {
            $t->dropColumn('unit');
        });
    }
};
