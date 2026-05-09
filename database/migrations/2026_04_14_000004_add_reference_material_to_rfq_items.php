<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rfq_items', function (Blueprint $table) {
            $table->enum('reference_type', ['none', 'drawing', 'physical_sample', 'both'])
                  ->default('none')->after('notes');
            $table->string('drawing_path')->nullable()->after('reference_type');
            $table->boolean('sample_received')->default(false)->after('drawing_path');
            $table->text('sample_description')->nullable()->after('sample_received');
            $table->string('sample_photo_path')->nullable()->after('sample_description');
        });

        // Migrate existing RFQ-level reference data down to the first item of each RFQ
        // so nothing is lost
        if (Schema::hasColumn('rfqs', 'reference_type')) {
            \DB::statement("
                UPDATE rfq_items ri
                INNER JOIN rfqs r ON r.id = ri.rfq_id
                INNER JOIN (
                    SELECT MIN(id) AS first_item_id, rfq_id
                    FROM rfq_items
                    GROUP BY rfq_id
                ) first_items ON first_items.first_item_id = ri.id
                SET
                    ri.reference_type     = r.reference_type,
                    ri.drawing_path       = r.drawing_path,
                    ri.sample_received    = r.sample_received,
                    ri.sample_description = r.sample_description
                WHERE r.reference_type IS NOT NULL
            ");
        }
    }

    public function down(): void
    {
        Schema::table('rfq_items', function (Blueprint $table) {
            $table->dropColumn([
                'reference_type', 'drawing_path', 'sample_received',
                'sample_description', 'sample_photo_path',
            ]);
        });
    }
};
