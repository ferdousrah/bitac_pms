<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shop-floor "bottleneck" flag. When a section's machines / manpower are
     * tied up on other work, the in-charge flags the job so PCD can reroute it
     * (do a free section's work first) instead of the job sitting idle.
     */
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->timestamp('bottleneck_at')->nullable()->after('remarks');
            $table->string('bottleneck_reason', 500)->nullable()->after('bottleneck_at');
            $table->foreignId('bottleneck_by')->nullable()->after('bottleneck_reason')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bottleneck_by');
            $table->dropColumn(['bottleneck_at', 'bottleneck_reason']);
        });
    }
};
