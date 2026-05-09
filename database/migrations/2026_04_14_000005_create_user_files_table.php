<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->string('original_name');               // what the user uploaded
            $table->string('stored_path');                 // relative path in storage/public
            $table->string('mime_type', 100);
            $table->string('extension', 20);
            $table->unsignedBigInteger('size_bytes');      // file size in bytes
            $table->enum('category', [
                'drawing',      // technical drawing / blueprint
                'sample_photo', // photo of a physical sample
                'image',        // general image
                'document',     // PDF / doc
                'other',
            ])->default('other');
            $table->text('description')->nullable();
            $table->unsignedInteger('usage_count')->default(0); // how many times referenced
            $table->timestamps();

            $table->index(['uploaded_by', 'category']);
            $table->index(['category', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_files');
    }
};
