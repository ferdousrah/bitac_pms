<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_files', function (Blueprint $table) {
            // Cached preview (PDF or PNG) path for files that need server-side conversion
            $table->string('preview_path')->nullable()->after('stored_path');
            $table->string('preview_mime', 100)->nullable()->after('preview_path');
            $table->timestamp('preview_generated_at')->nullable()->after('preview_mime');
            $table->enum('preview_status', ['none', 'pending', 'ready', 'failed'])->default('none')->after('preview_generated_at');
            $table->text('preview_error')->nullable()->after('preview_status');
        });
    }

    public function down(): void
    {
        Schema::table('user_files', function (Blueprint $table) {
            $table->dropColumn(['preview_path', 'preview_mime', 'preview_generated_at', 'preview_status', 'preview_error']);
        });
    }
};
