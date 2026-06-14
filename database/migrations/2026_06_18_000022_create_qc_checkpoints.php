<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Master list of QC checkpoints. The inspection Create form pulls every active
 * row into its default checklist so inspectors don't have to retype the same
 * common points (dimensional accuracy, surface finish, material grade etc.)
 * for every inspection. Admins can add/edit/reorder via Master Data.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('qc_checkpoints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $table->string('name', 200);
            $table->string('category', 100)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['center_id', 'is_active', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qc_checkpoints');
    }
};
