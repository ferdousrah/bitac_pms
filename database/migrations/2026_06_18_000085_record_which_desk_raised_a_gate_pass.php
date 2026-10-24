<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Which desk raised a gate pass — `ied` or `pcd`. IED and PCD share one table
 * and nothing recorded the desk, so Billing & Accounts could not be shown
 * "PCD's Gate Pass Out" (BITAC, 2026-10-24).
 *
 * Existing rows are worked out from the one thing that differs: a PCD pass
 * goes through approval (pending, rejected, or approved by someone) and an
 * IED pass is issued on the spot.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('gate_passes', 'origin')) {
            Schema::table('gate_passes', function (Blueprint $table) {
                $table->string('origin', 10)->default('ied')->after('direction')->index();
            });
        }

        DB::table('gate_passes')
            ->where(fn ($q) => $q->whereIn('status', ['pending_approval', 'rejected'])->orWhereNotNull('approved_by'))
            ->update(['origin' => 'pcd']);
    }

    public function down(): void
    {
        if (Schema::hasColumn('gate_passes', 'origin')) {
            Schema::table('gate_passes', function (Blueprint $table) {
                $table->dropIndex(['origin']);
                $table->dropColumn('origin');
            });
        }
    }
};
