<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            if (! Schema::hasColumn('rfqs', 'rfq_letter_title')) {
                $t->string('rfq_letter_title', 200)->nullable()->after('rfq_letter_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            if (Schema::hasColumn('rfqs', 'rfq_letter_title')) $t->dropColumn('rfq_letter_title');
        });
    }
};
