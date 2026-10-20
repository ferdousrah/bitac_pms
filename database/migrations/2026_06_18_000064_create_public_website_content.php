<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * The public website's own content.
 *
 * `/portfolio` was one page listing projects. BITAC want a corporate site —
 * about, products, clients, news & events, galleries, important links,
 * contact. Products come from `portfolio_projects`, clients from `customers`,
 * and about/contact from the centre's letterhead, all of which already exist.
 * These three tables are the parts that had nowhere to live.
 *
 * ⚠️ **One text column per field, NOT an English/Bangla pair** (BITAC): what
 * the editor types is what the site shows — Bangla in, Bangla out. Paired
 * columns would have forced every post to be written twice and left half the
 * site blank whenever it was not. Bangla is ordinary UTF-8 text here; the
 * tables are `utf8mb4` like the rest of the schema, so it just works.
 *
 * The free text of the site (hero line, about paragraphs) goes in the existing
 * `settings` key-value store, not here — it is a handful of strings, not rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── News, events, notices and tenders ────────────────────────────
        Schema::create('news_posts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            // What it is decides where it shows and how it reads: a notice and
            // an event are not the same thing to a visitor.
            $table->string('kind', 20)->default('news');   // news|event|notice|tender
            $table->string('excerpt', 400)->nullable();
            $table->text('body')->nullable();
            $table->string('cover_image_path')->nullable();
            // An EVENT happens on a date; a notice is merely published on one.
            $table->date('event_date')->nullable();
            $table->string('location')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->boolean('is_published')->default(false);
            $table->unsignedInteger('sort')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_published', 'published_at']);
        });

        // ── Important links (ministry, portals, forms) ───────────────────
        Schema::create('site_links', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('url');
            // Which block of the footer / links page it belongs to.
            $table->string('group', 40)->default('important'); // important|ministry|service
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'group', 'sort']);
        });

        // ── Photo + video gallery ────────────────────────────────────────
        // ⚠️ ONE table, not two. A photo and a video differ only in where the
        // media lives (an uploaded file vs an embed URL); everything else —
        // title, caption, album, ordering, publish flag — is identical, and
        // two tables would be the same admin screen written twice.
        Schema::create('gallery_items', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10)->default('photo');  // photo|video
            $table->string('title')->nullable();
            $table->string('caption', 400)->nullable();
            $table->string('album', 60)->nullable();
            $table->string('image_path')->nullable();      // photo: the file
            $table->string('video_url')->nullable();       // video: YouTube/Vimeo
            $table->date('taken_on')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'kind', 'sort']);
        });

        // ── Who may edit the public site ─────────────────────────────────
        // `manage portfolio` already exists and guards the project pages; the
        // website's own content is the same job, so it reuses that permission
        // rather than inventing a second one nobody is granted.
        $perm = Permission::firstOrCreate(['name' => 'manage portfolio', 'guard_name' => 'web']);
        foreach (['super-admin', 'it-admin', 'management'] as $role) {
            Role::where('name', $role)->first()?->givePermissionTo($perm);
        }

        // A site with no links reads as broken rather than new, so seed the
        // handful that are true of BITAC regardless of what they add later.
        $now = now();
        DB::table('site_links')->insert([
            ['label' => 'শিল্প মন্ত্রণালয়', 'url' => 'https://moind.gov.bd', 'group' => 'ministry', 'sort' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['label' => 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', 'url' => 'https://bangladesh.gov.bd', 'group' => 'ministry', 'sort' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['label' => 'জাতীয় তথ্য বাতায়ন', 'url' => 'https://bangladesh.gov.bd', 'group' => 'important', 'sort' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['label' => 'ই-জিপি (e-GP)', 'url' => 'https://www.eprocure.gov.bd', 'group' => 'important', 'sort' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['label' => 'ফরম পোর্টাল', 'url' => 'https://forms.gov.bd', 'group' => 'important', 'sort' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('gallery_items');
        Schema::dropIfExists('site_links');
        Schema::dropIfExists('news_posts');
        // `manage portfolio` is left alone — it predates this migration and
        // guards the project pages too.
    }
};
