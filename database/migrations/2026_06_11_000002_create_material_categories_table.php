<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('material_categories', function (Blueprint $t) {
            $t->id();
            $t->string('code', 50)->unique();     // stable identifier, stored on materials.category
            $t->string('name', 100);              // display name
            $t->text('description')->nullable();
            $t->unsignedInteger('display_order')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_categories');
    }
};
