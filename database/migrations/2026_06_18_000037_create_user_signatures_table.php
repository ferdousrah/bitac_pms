<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A user may hold several signatures, one of which is their default.
 *
 * BITAC officers sign with a scanned block that already carries their name,
 * designation, centre and contacts under the pen stroke — and the same person
 * needs more than one (a Bangla block and an English one, or one per post they
 * hold). `users.signature_path` could only ever hold a single image, so this
 * table replaces it; the column stays put as a fallback for anything not yet
 * migrated, but nothing writes it any more.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_signatures', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            // What the owner calls it in the picker — "Bangla block", "English".
            $t->string('label', 80);
            // Relative to the `public` disk, same as the old users.signature_path.
            $t->string('path', 255);
            // Exactly one per user should be true; enforced in UserSignature.
            $t->boolean('is_default')->default(false);
            $t->timestamps();

            $t->index(['user_id', 'is_default']);
        });

        // Carry every existing signature across as that user's default, so no
        // document loses its signatory the moment this ships.
        $now = now();
        $rows = DB::table('users')
            ->whereNotNull('signature_path')
            ->where('signature_path', '!=', '')
            ->get(['id', 'signature_path']);

        foreach ($rows as $row) {
            DB::table('user_signatures')->insert([
                'user_id'    => $row->id,
                'label'      => 'Signature',
                'path'       => $row->signature_path,
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_signatures');
    }
};
