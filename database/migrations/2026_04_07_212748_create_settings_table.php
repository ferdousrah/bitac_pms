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
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Seed defaults
        \DB::table('settings')->insert([
            ['key' => 'brand_name',      'value' => 'BITAC PMS',  'created_at' => now(), 'updated_at' => now()],
            ['key' => 'brand_subtitle',   'value' => 'Production Management', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'primary_color',    'value' => '#ff7a0f',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'sidebar_color',    'value' => '#0f172a',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'sidebar_accent',   'value' => '#1e293b',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'logo_path',        'value' => null,        'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
