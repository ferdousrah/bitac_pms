<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Items move between shops one by one (BITAC, 2026-10-31, from the 2026-10-10
 * run-through: "আংশিক জব ট্রান্সফার টু নেক্সট করা যাবে").
 *
 * `work_order_sections.item_ledger` = {operation_sheet_id: {r: received, f:
 * forwarded}} — each item's own quantities at the section. See
 * `WorkOrderSection` ("Item by item").
 *
 * Jobs already moving keep their place: the old figures applied to EVERY item
 * of the job at once (a transfer of 5 moved 5 of each), so every item with work
 * at the section is given the section's received and forwarded figures as they
 * stand. Raw DB, no events.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('work_order_sections', 'item_ledger')) {
            Schema::table('work_order_sections', function (Blueprint $t) {
                $t->json('item_ledger')->nullable()->after('forwarded_qty');
            });
        }

        $rows = DB::table('work_order_sections')
            ->whereNull('item_ledger')
            ->where(fn ($q) => $q->whereNotNull('received_qty')->orWhere('forwarded_qty', '>', 0))
            ->get(['id', 'work_order_id', 'section_id', 'received_qty', 'forwarded_qty']);

        foreach ($rows as $w) {
            $sheetIds = DB::table('operation_steps')
                ->join('operation_sheets', 'operation_sheets.id', '=', 'operation_steps.operation_sheet_id')
                ->where('operation_sheets.work_order_id', $w->work_order_id)
                ->where('operation_steps.section_id', $w->section_id)
                ->distinct()->pluck('operation_sheets.id');
            if ($sheetIds->isEmpty()) continue;

            $ledger = [];
            foreach ($sheetIds as $id) {
                $ledger[$id] = array_filter([
                    'r' => $w->received_qty !== null ? (float) $w->received_qty : null,
                    'f' => (float) $w->forwarded_qty,
                ], fn ($v) => $v !== null);
            }
            DB::table('work_order_sections')->where('id', $w->id)->update(['item_ledger' => json_encode($ledger)]);
        }
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $t) {
            $t->dropColumn('item_ledger');
        });
    }
};
