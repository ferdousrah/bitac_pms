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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50);          // rfq_created, quotation_approved, wo_status, etc.
            $table->string('title');
            $table->string('body')->nullable();
            $table->string('icon', 50)->nullable();   // flaticon class
            $table->string('color', 20)->default('blue'); // brand, green, red, amber, etc.
            $table->string('link')->nullable();        // URL to navigate on click
            $table->json('data')->nullable();          // extra payload
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
