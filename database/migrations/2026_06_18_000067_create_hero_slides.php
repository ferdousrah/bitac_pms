<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The home page's hero — a slide show of BITAC's own photographs and footage.
 *
 * ⚠️ Deliberately NOT `gallery_items`. A gallery photo is a record of an
 * event; a hero slide is the first thing a visitor sees, it carries its own
 * headline and call to action, and it is chosen and ordered for that job. Hang
 * the hero off the gallery and every photo someone uploads becomes a
 * full-screen banner.
 *
 * One `title`/`subtitle`, no BN/EN pair — the same rule as the rest of the
 * website content.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hero_slides')) {
            return;
        }

        Schema::create('hero_slides', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10)->default('image');   // image | video
            $table->string('image_path')->nullable();

            // ⚠️ A direct video FILE (.mp4/.webm), not a YouTube link. A
            // background video has to autoplay muted and loop with no chrome,
            // which a YouTube iframe will not reliably do — it would show the
            // player's own controls and branding over BITAC's front page.
            $table->string('video_path')->nullable();
            $table->string('video_url')->nullable();

            // The still behind a video while it buffers, and for the phones
            // that refuse to autoplay at all.
            $table->string('poster_path')->nullable();

            $table->string('title')->nullable();
            $table->string('subtitle', 500)->nullable();
            $table->string('cta_label', 80)->nullable();
            $table->string('cta_url')->nullable();

            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hero_slides');
    }
};
