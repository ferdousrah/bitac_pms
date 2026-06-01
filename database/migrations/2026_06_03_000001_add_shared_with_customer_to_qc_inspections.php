<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('qc_inspections', function (Blueprint $t) {
            $t->boolean('shared_with_customer')->default(false)->after('notes');
            $t->timestamp('shared_at')->nullable()->after('shared_with_customer');
            $t->unsignedBigInteger('shared_by')->nullable()->after('shared_at');
        });
    }

    public function down(): void
    {
        Schema::table('qc_inspections', function (Blueprint $t) {
            $t->dropColumn(['shared_with_customer', 'shared_at', 'shared_by']);
        });
    }
};
