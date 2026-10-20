<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Collaborators and partners, shown on the public site as a wall of logos.
 *
 * ⚠️ Deliberately NOT `customers`. A client is somebody who placed an order
 * and is already on the site's client list by name; a partner is an
 * institution BITAC works *with* — a ministry, a university, a donor
 * programme, a foreign technical agency — and most of them have no customer
 * record at all, nor should they.
 *
 * One `name`, no BN/EN pair — the same rule as the rest of the website
 * content.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('partners')) {
            return;
        }

        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind', 20)->default('partner');   // partner | collaborator
            // The whole point of the section. A row without one would be a
            // name in an empty box, so the save refuses it.
            $table->string('logo_path')->nullable();
            $table->string('url')->nullable();
            $table->string('note', 255)->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'kind', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partners');
    }
};
