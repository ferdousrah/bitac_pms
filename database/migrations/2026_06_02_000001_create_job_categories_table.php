<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('job_categories', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('center_id')->nullable()->index();
            $t->string('name');
            $t->string('code', 32)->nullable();
            $t->text('description')->nullable();
            $t->unsignedInteger('display_order')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['center_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_categories');
    }
};
