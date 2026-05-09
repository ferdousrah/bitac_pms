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
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();          // IED, PCD, CNC, MACHINE_SHOP, etc.
            $table->string('name', 100);                    // Display name
            $table->string('name_bn', 100)->nullable();     // Bengali name
            $table->enum('type', ['functional', 'production_shop'])->default('production_shop');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Seed core sections
        $now = now();
        \DB::table('sections')->insert([
            ['code' => 'IED',            'name' => 'Industrial Engineering',  'name_bn' => 'শিল্প প্রকৌশল বিভাগ',     'type' => 'functional',      'display_order' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'PCD',            'name' => 'Production Control',      'name_bn' => 'উৎপাদন নিয়ন্ত্রণ বিভাগ',  'type' => 'functional',      'display_order' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'STORES',         'name' => 'Stores',                  'name_bn' => 'স্টোর',                   'type' => 'functional',      'display_order' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'MACHINE_SHOP',   'name' => 'Machine Shop',            'name_bn' => 'যান্ত্রিক',                'type' => 'production_shop', 'display_order' => 4, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CNC',            'name' => 'CNC',                     'name_bn' => 'সিএনসি',                  'type' => 'production_shop', 'display_order' => 5, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'CASTING',        'name' => 'Casting',                 'name_bn' => 'ঢালাই',                   'type' => 'production_shop', 'display_order' => 6, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'MOLD',           'name' => 'Mold & Pattern',          'name_bn' => 'প্যাটার্ন',                 'type' => 'production_shop', 'display_order' => 7, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'HEAT_TREATMENT', 'name' => 'Heat Treatment',          'name_bn' => 'হিট ট্রিটমেন্ট',           'type' => 'production_shop', 'display_order' => 8, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'FITTING',        'name' => 'Fitting / Assembly',      'name_bn' => 'ফিটিং',                   'type' => 'production_shop', 'display_order' => 9, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['code' => 'QC',             'name' => 'Quality Control',         'name_bn' => 'পর্যবেক্ষণ',              'type' => 'functional',      'display_order' => 10, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sections');
    }
};
