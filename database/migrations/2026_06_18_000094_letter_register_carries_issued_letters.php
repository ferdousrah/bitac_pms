<?php

use App\Models\LetterRegister;
use App\Models\RfqLetter;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A letter IED issues from IED → Letters is entered in IED's প্রেরিত চিঠির
 * রেকর্ড by itself (BITAC, 2026-10-31: "ok add koro").
 *
 * `rfq_letter_id` links the register row to the letter; unique, so a letter
 * is entered once, and cascade, so deleting the letter takes its entry with
 * it — the register never lists a letter that no longer exists. Every letter
 * already issued is entered now.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('letter_registers', 'rfq_letter_id')) {
            Schema::table('letter_registers', function (Blueprint $t) {
                $t->foreignId('rfq_letter_id')->nullable()->unique()->after('direction')
                    ->constrained('rfq_letters')->cascadeOnDelete();
            });
        }

        RfqLetter::withoutGlobalScopes()->with(['signatory', 'customer'])
            ->where('status', '!=', 'draft')
            ->each(fn (RfqLetter $l) => LetterRegister::syncFromRfqLetter($l));
    }

    public function down(): void
    {
        LetterRegister::withoutGlobalScopes()->whereNotNull('rfq_letter_id')->delete();
        Schema::table('letter_registers', function (Blueprint $t) {
            $t->dropConstrainedForeignId('rfq_letter_id');
        });
    }
};
