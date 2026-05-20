<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            // Job title — shown beneath the name on signature blocks of every
            // generated PDF (Cost Estimate, Quotation). e.g. "Executive Engineer",
            // "নির্বাহী প্রকৌশলী", "Production Officer".
            $t->string('designation', 120)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('designation');
        });
    }
};
