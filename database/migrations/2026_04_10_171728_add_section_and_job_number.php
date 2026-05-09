<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add section_id to machines (alongside existing work_centre_id for now)
        Schema::table('machines', function (Blueprint $table) {
            $table->foreignId('section_id')->nullable()->after('work_centre_id')->constrained()->nullOnDelete();
            $table->decimal('rate_group_a', 10, 2)->nullable()->after('status');  // Small/Cottage industry
            $table->decimal('rate_group_b', 10, 2)->nullable()->after('rate_group_a'); // Corp/Multinational
            $table->decimal('rate_group_c', 10, 2)->nullable()->after('rate_group_b'); // Import substitute
        });

        // Add job_number (5-digit BITAC sequence) to work_orders
        Schema::table('work_orders', function (Blueprint $table) {
            $table->unsignedInteger('job_number')->nullable()->unique()->after('wo_number');
            $table->foreignId('section_id')->nullable()->after('product_id')->constrained()->nullOnDelete();
        });

        // Map existing machines to sections by matching work_centre name
        $matches = [
            'Machine Shop'   => 'MACHINE_SHOP',
            'Heat Treatment' => 'HEAT_TREATMENT',
            'Fabrication'    => 'MACHINE_SHOP',
            'Welding'        => 'MACHINE_SHOP',
            'Assembly'       => 'FITTING',
        ];
        foreach ($matches as $wcName => $sectionCode) {
            $sectionId = \DB::table('sections')->where('code', $sectionCode)->value('id');
            $wcId = \DB::table('work_centres')->where('name', $wcName)->value('id');
            if ($sectionId && $wcId) {
                \DB::table('machines')->where('work_centre_id', $wcId)->update(['section_id' => $sectionId]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['section_id']);
            $table->dropColumn(['job_number', 'section_id']);
        });
        Schema::table('machines', function (Blueprint $table) {
            $table->dropForeign(['section_id']);
            $table->dropColumn(['section_id', 'rate_group_a', 'rate_group_b', 'rate_group_c']);
        });
    }
};
