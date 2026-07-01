<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Records how many pieces were moved on a forward (partial) handoff. */
    public function up(): void
    {
        Schema::table('section_handoffs', function (Blueprint $table) {
            $table->decimal('qty', 12, 2)->nullable()->after('direction');
        });
    }

    public function down(): void
    {
        Schema::table('section_handoffs', function (Blueprint $table) {
            $table->dropColumn('qty');
        });
    }
};
