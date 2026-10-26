<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * মূসক ৬.৩ gets the bill's "Sign Document" (BITAC, 2026-10-27): who signed
 * it and when.
 *
 * ⚠️ The PDF used to print the named signatory's DEFAULT signature whenever
 * no signature was stored — naming someone on the form signed for them. That
 * fallback is gone (MusakChallanRenderer). So that an ISSUED challan reprints
 * exactly as it did, the signature it was printing is fixed onto it here.
 * A legal document must not change on reprint. Drafts are left unsigned.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('musak_challans', function (Blueprint $t) {
            if (! Schema::hasColumn('musak_challans', 'signed_at')) {
                $t->foreignId('signed_by')->nullable()->after('signature_path')->constrained('users')->nullOnDelete();
                $t->timestamp('signed_at')->nullable()->after('signed_by');
            }
        });

        // Already carrying a signature → record it as signed by its signatory.
        DB::table('musak_challans')->whereNotNull('signature_path')->whereNull('signed_at')
            ->update(['signed_by' => DB::raw('signatory_user_id'), 'signed_at' => DB::raw('COALESCE(issued_at, updated_at)')]);

        // Issued, printing the signatory's default by fallback → fix it on.
        $rows = DB::table('musak_challans')->where('status', 'issued')
            ->whereNull('signature_path')->whereNotNull('signatory_user_id')->get(['id', 'signatory_user_id', 'issued_at', 'updated_at']);
        foreach ($rows as $r) {
            $path = DB::table('user_signatures')->where('user_id', $r->signatory_user_id)
                ->orderByDesc('is_default')->orderBy('id')->value('path')
                ?: DB::table('users')->where('id', $r->signatory_user_id)->value('signature_path');
            if ($path) {
                DB::table('musak_challans')->where('id', $r->id)->update([
                    'signature_path' => $path,
                    'signed_by'      => $r->signatory_user_id,
                    'signed_at'      => $r->issued_at ?? $r->updated_at,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('musak_challans', function (Blueprint $t) {
            $t->dropConstrainedForeignId('signed_by');
            $t->dropColumn('signed_at');
        });
    }
};
