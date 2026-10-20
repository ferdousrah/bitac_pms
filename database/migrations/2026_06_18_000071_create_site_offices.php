<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BITAC's offices on the public Contact page — head office and the regional
 * centres — each with its own address, phones, map pin and contact persons.
 *
 * ⚠️ **Deliberately NOT `centers`.** That table is the PMS's operational
 * tenancy: every job, quotation, user and approval chain is scoped to a
 * centre. Creating Chattogram there just to publish its address would add an
 * empty branch to the PMS, to the centre switcher and to every centre-scoped
 * query. An office MAY link to a centre (`center_id`), and then fills any
 * blank field from that centre's letterhead, so Dhaka is not typed twice.
 *
 * One field per thing, no BN/EN pair — the website content rule.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('site_offices')) {
            Schema::create('site_offices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
                $table->string('slug', 60)->unique();   // the #anchor a visitor can share
                $table->string('name');
                $table->text('address')->nullable();
                $table->string('phone')->nullable();
                $table->string('fax')->nullable();
                $table->string('email')->nullable();
                // What the map searches for. English geocodes far more
                // reliably than a Bangla postal address does.
                $table->string('map_query')->nullable();
                // An exact pin, when someone has one — wins over the query.
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->boolean('is_head_office')->default(false);
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['is_active', 'sort']);
            });
        }

        if (! Schema::hasTable('site_office_contacts')) {
            Schema::create('site_office_contacts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('site_office_id')->constrained('site_offices')->cascadeOnDelete();
                // ⚠️ A name is OPTIONAL. A government office publishes many of
                // its contacts by post alone ("Executive Engineer (IED)") with
                // the post's own email — the person in it changes, the address
                // does not.
                $table->string('name')->nullable();
                $table->string('designation');
                $table->string('phone')->nullable();
                $table->string('mobile')->nullable();
                $table->string('email')->nullable();
                $table->unsignedInteger('sort')->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['site_office_id', 'is_active', 'sort']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('site_office_contacts');
        Schema::dropIfExists('site_offices');
    }
};
