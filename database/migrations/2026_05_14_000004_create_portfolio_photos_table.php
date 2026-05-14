<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('portfolio_photos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('portfolio_project_id')
              ->constrained('portfolio_projects')
              ->cascadeOnDelete();
            $t->string('stored_path');           // path on the public disk
            $t->string('caption', 200)->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
            $t->index(['portfolio_project_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_photos');
    }
};
