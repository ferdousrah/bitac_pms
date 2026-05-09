<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_folder_id')->nullable()->constrained('file_folders')->nullOnDelete();
            $table->string('name', 150);
            $table->string('color', 20)->default('indigo'); // indigo / blue / emerald / amber / rose / slate
            $table->string('icon', 40)->nullable();          // optional emoji/icon name
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'parent_folder_id']);
        });

        Schema::table('user_files', function (Blueprint $table) {
            $table->foreignId('folder_id')->nullable()->after('uploaded_by')
                  ->constrained('file_folders')->nullOnDelete();
            $table->index('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('user_files', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropColumn('folder_id');
        });
        Schema::dropIfExists('file_folders');
    }
};
