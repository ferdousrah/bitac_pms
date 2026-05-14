<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('portfolio_projects', function (Blueprint $t) {
            $t->id();

            // Public-facing content
            $t->string('title');
            $t->string('slug')->unique();      // URL-friendly key, e.g. "pump-impeller-aci-motors"
            $t->string('client_name')->nullable();
            $t->string('category', 60)->nullable(); // e.g. "Machining", "Casting", "Heat Treatment"
            $t->string('summary', 300)->nullable(); // 1-2 line teaser for card listings
            $t->text('description')->nullable();    // Full write-up — multi-paragraph

            // Technical specs — key/value pairs stored as JSON.
            // e.g. [{"label":"Material","value":"Cast SS304"},{"label":"Dimensions","value":"Ø180×350mm"}]
            $t->json('specs')->nullable();

            // Hero image shown on listing card + detail page top
            $t->string('cover_image_path')->nullable();

            // Metadata
            $t->date('completed_at')->nullable();
            $t->boolean('is_published')->default(false); // only published rows show on public site
            $t->unsignedInteger('display_order')->default(0); // manual ordering on listing
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $t->timestamps();
            $t->index(['is_published', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_projects');
    }
};
