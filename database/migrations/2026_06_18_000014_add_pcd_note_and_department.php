<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two PCD-form additions:
 *  - `work_order_items.pcd_note` — per-item note authored by PCD on the
 *    Work Order routing form. Distinct from the customer's `notes` and
 *    IED's `ied_note` so each authoring layer is preserved.
 *  - `work_orders.department` — editable কার্যবিন্যাস value on the WO form.
 *    Defaults to PCD per BITAC's paper convention but PCD can override it
 *    when a job sits with a different department.
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('work_order_items', 'pcd_note')) {
            Schema::table('work_order_items', function (Blueprint $table) {
                $table->text('pcd_note')->nullable()->after('ied_note');
            });
        }

        if (!Schema::hasColumn('work_orders', 'department')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->string('department', 200)->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('work_order_items', 'pcd_note')) {
            Schema::table('work_order_items', function (Blueprint $table) {
                $table->dropColumn('pcd_note');
            });
        }
        if (Schema::hasColumn('work_orders', 'department')) {
            Schema::table('work_orders', function (Blueprint $table) {
                $table->dropColumn('department');
            });
        }
    }
};
