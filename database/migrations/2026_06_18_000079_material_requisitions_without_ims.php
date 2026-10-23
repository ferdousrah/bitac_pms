<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * BITAC (2026-10-23): material requisitions are not pushed to IMS — the status
 * is moved along by hand. So:
 *   - `status` is widened from an ENUM to varchar(30), like every other status
 *     column in this codebase, so a new step never needs an ALTER again;
 *   - anything that was `sent_to_ims` becomes `pending_approval` ("Submitted"):
 *     it had left PCD and was waiting on the store, which is what that means now.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE material_requisitions MODIFY status VARCHAR(30) NOT NULL DEFAULT 'draft'");
        DB::table('material_requisitions')->where('status', 'sent_to_ims')->update(['status' => 'pending_approval']);

        // ⚠️ A line is the MATERIAL; the description is only its optional size/spec.
        // The column was NOT NULL, which is why the old save silently dropped any
        // line whose spec was left blank.
        DB::statement('ALTER TABLE material_requisition_items MODIFY description TEXT NULL');
    }

    public function down(): void
    {
        DB::table('material_requisition_items')->whereNull('description')->update(['description' => '']);
        DB::statement("ALTER TABLE material_requisition_items MODIFY description VARCHAR(255) NOT NULL");

        // The enum cannot hold anything outside its list — fold unknowns back to draft first.
        $enum = ['draft', 'pending_approval', 'sent_to_ims', 'approved', 'partially_issued', 'issued', 'received', 'cancelled'];
        DB::table('material_requisitions')->whereNotIn('status', $enum)->update(['status' => 'draft']);
        DB::statement("ALTER TABLE material_requisitions MODIFY status ENUM('" . implode("','", $enum) . "') NOT NULL DEFAULT 'draft'");
    }
};
