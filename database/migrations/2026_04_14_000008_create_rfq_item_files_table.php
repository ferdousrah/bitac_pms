<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rfq_item_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_file_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['drawing', 'sample_photo']);
            $table->string('stored_path');         // denormalized for quick access (survives user_file deletion)
            $table->string('original_name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['rfq_item_id', 'type']);
        });

        // Migrate existing single-file data into the pivot
        DB::statement("
            INSERT INTO rfq_item_files (rfq_item_id, type, stored_path, original_name, sort_order, created_at, updated_at)
            SELECT id, 'drawing', drawing_path, SUBSTRING_INDEX(drawing_path, '/', -1), 0, NOW(), NOW()
            FROM rfq_items
            WHERE drawing_path IS NOT NULL AND drawing_path != ''
        ");
        DB::statement("
            INSERT INTO rfq_item_files (rfq_item_id, type, stored_path, original_name, sort_order, created_at, updated_at)
            SELECT id, 'sample_photo', sample_photo_path, SUBSTRING_INDEX(sample_photo_path, '/', -1), 0, NOW(), NOW()
            FROM rfq_items
            WHERE sample_photo_path IS NOT NULL AND sample_photo_path != ''
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_item_files');
    }
};
