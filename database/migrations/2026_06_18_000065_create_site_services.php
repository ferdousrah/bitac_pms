<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * **Services** on the public website — BITAC's four service lines, as opposed
 * to the individual products in `portfolio_projects`.
 *
 * ⚠️ These are NOT `job_categories` or `operations`. Those are the internal
 * vocabulary the costing and routing are built on; this is the public
 * description of what the office does, and the two must be free to be worded
 * differently.
 *
 * One `title`/`summary`/`body`, no BN/EN pair — same rule as the rest of the
 * website content.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('site_services')) {
            Schema::create('site_services', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('summary', 500)->nullable();
                $table->text('body')->nullable();
                // A fixed icon name from SiteService::ICONS, not a free-text
                // class — a typo in a Flaticon class renders nothing at all.
                $table->string('icon', 60)->nullable();
                $table->string('image_path')->nullable();
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('is_active')->default(true);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['is_active', 'sort']);
            });
        }

        // Seeded with BITAC's real service lines so the page is not empty on
        // the day it goes up. Idempotent — a second run adds nothing.
        if (DB::table('site_services')->count() === 0) {
            $now = now();
            DB::table('site_services')->insert([
                [
                    'title'   => 'Import-Substitute Manufacturing',
                    'summary' => 'Precision components, spares and assemblies made in Bangladesh instead of imported — machining, fabrication, heat treatment and surface finishing to drawing.',
                    'icon'    => 'settings',
                    'sort'    => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ],
                [
                    'title'   => 'Industrial Training',
                    'summary' => 'Hands-on courses for industry and government on machining, welding, CNC, maintenance, CAD and quality — taught on working shop-floor equipment.',
                    'icon'    => 'graduation',
                    'sort'    => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ],
                [
                    'title'   => 'Testing & Calibration',
                    'summary' => 'Material, dimensional and performance testing with inspection reports industry and procurement can rely on.',
                    'icon'    => 'shield',
                    'sort'    => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ],
                [
                    'title'   => 'Research, Development & Consultancy',
                    'summary' => 'Design and prototyping of import-substitute items, reverse engineering from a sample, and technical advice on production problems.',
                    'icon'    => 'bulb',
                    'sort'    => 4, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('site_services');
    }
};
