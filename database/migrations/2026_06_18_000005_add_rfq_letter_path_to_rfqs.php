<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            if (! Schema::hasColumn('rfqs', 'rfq_letter_path')) {
                $t->string('rfq_letter_path')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $t) {
            if (Schema::hasColumn('rfqs', 'rfq_letter_path')) $t->dropColumn('rfq_letter_path');
        });
    }
};
