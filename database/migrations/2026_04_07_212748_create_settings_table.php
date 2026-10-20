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
            ['key' => 'primary_color',    'value' => '#5b2d90',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'sidebar_color',    'value' => '#1b1233',   'created_at' => now(), 'updated_at' => now()],
            ['key' => 'sidebar_accent',   'value' => '#2b1d4d',   'created_at' => now(), 'updated_at' => now()],
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
