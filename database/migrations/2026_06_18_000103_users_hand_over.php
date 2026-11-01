<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Handing a post over to the next person (BITAC, 2026-11-01). Accounts are made
 * on the POST's email (xen.ied@…), but what someone signed and approved must
 * stay theirs when the post changes hands — so the account is not renamed; the
 * old one is retired with its history and a new one takes the post's email.
 * These two columns record that link, for the screens.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('handed_over_to_id')->nullable()->after('deactivation_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('handed_over_at')->nullable()->after('handed_over_to_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('handed_over_to_id');
            $table->dropColumn('handed_over_at');
        });
    }
};
