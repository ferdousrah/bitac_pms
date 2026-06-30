<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            // Self-referencing parent for sub-sections. A production shop can have
            // sub-sections (e.g. Machine Shop → Lathe, Milling). Top-level sections
            // have parent_id = null. Hierarchy is intentionally ONE level deep.
            $table->foreignId('parent_id')->nullable()->after('id')
                ->constrained('sections')->nullOnDelete();
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
