<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('machines', function (Blueprint $t) {
            if (! Schema::hasColumn('machines', 'rate_group_student')) {
                $t->decimal('rate_group_student', 10, 2)->nullable()->after('rate_group_c');
            }
            if (! Schema::hasColumn('machines', 'rate_group_public')) {
                $t->decimal('rate_group_public', 10, 2)->nullable()->after('rate_group_student');
            }
        });
    }

    public function down(): void
    {
        Schema::table('machines', function (Blueprint $t) {
            if (Schema::hasColumn('machines', 'rate_group_public'))  $t->dropColumn('rate_group_public');
            if (Schema::hasColumn('machines', 'rate_group_student')) $t->dropColumn('rate_group_student');
        });
    }
};
