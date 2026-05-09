<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->enum('reference_type', ['none', 'drawing', 'physical_sample', 'both'])->default('none')->after('notes');
            $table->string('drawing_path')->nullable()->after('reference_type');
            $table->boolean('sample_received')->default(false)->after('drawing_path');
            $table->text('sample_description')->nullable()->after('sample_received');
        });
    }

    public function down(): void
    {
        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropColumn(['reference_type', 'drawing_path', 'sample_received', 'sample_description']);
        });
    }
};
