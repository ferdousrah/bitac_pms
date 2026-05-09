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
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->string('category', 50)->nullable();         // steel, non_ferrous, specialty, alloy
            $table->decimal('rate_per_kg', 10, 2);              // Tk/Kg
            $table->decimal('density_kg_m3', 10, 2)->nullable();   // for weight calc from volume
            $table->decimal('density_kg_in3', 10, 5)->nullable();  // imperial alternative
            $table->string('notes', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('category');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
