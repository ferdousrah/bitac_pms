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
        Schema::create('machining_operations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->enum('category', ['machining', 'casting', 'plating', 'heat_treatment', 'surface_treatment', 'fabrication', 'other'])
                ->default('machining');
            $table->string('default_unit', 20)->default('hour');  // hour, kg, sqft, pcs
            $table->decimal('rate_group_a', 10, 2)->nullable();   // Small/Cottage Industry
            $table->decimal('rate_group_b', 10, 2)->nullable();   // Corporate/Multinational/Large
            $table->decimal('rate_group_c', 10, 2)->nullable();   // Import Substitute
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->string('notes', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['category', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machining_operations');
    }
};
