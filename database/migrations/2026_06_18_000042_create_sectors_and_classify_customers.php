<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Classify customers so IED can report by who the work is for.
 *
 * Two questions BITAC asks of every client:
 *   customer_type  Government Entity, or Private Organization
 *   sector         which part of that world — Power, BCIC, Defence, textiles…
 *
 * A sector applies to BOTH types, so one list carries a `type` tag
 * (government / private / both) and the customer form shows only the sectors
 * that fit the chosen type.
 *
 * ⚠️ **Sectors are NATIONAL, not per centre** — deliberately unlike
 * `job_categories`, which uses HasCenter. If each centre held its own rows,
 * Dhaka's "Power" and Chittagong's "Power" would be different ids and
 * "jobs by sector across BITAC" could only be grouped by name, which breaks
 * the moment someone types it differently. One list, comparable everywhere.
 * That also means only a super admin should be editing it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sectors', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120)->unique();
            $t->string('code', 32)->nullable();
            // Which customer types this sector is offered for. `both` shows up
            // under either — a textile mill may be state-owned or private.
            $t->enum('applies_to', ['government', 'private', 'both'])->default('both');
            $t->string('description', 500)->nullable();
            $t->unsignedInteger('display_order')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();

            $t->index(['is_active', 'display_order']);
        });

        Schema::table('customers', function (Blueprint $t) {
            // Nullable on purpose: every existing customer starts unclassified
            // and reports show them as "Unspecified" until someone fills it in.
            $t->string('customer_type', 20)->nullable()->after('name');
            $t->foreignId('sector_id')->nullable()->after('customer_type')
                ->constrained('sectors')->nullOnDelete();
            $t->index('customer_type');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            $t->dropConstrainedForeignId('sector_id');
            $t->dropIndex(['customer_type']);
            $t->dropColumn('customer_type');
        });

        Schema::dropIfExists('sectors');
    }
};
