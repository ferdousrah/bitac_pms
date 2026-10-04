<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * A shop has a নির্বাহী প্রকৌশলী over assistant engineers.
 *
 * Work arriving at a shop used to be everybody's at once: anyone whose
 * `users.section_id` was the shop saw all of it and could do all of it. BITAC
 * works the other way — the job reaches the XEN, he reads it and hands it to
 * one of his AEs (or straight to a sub-section), and that AE receives it
 * before doing anything with it.
 *
 * ⚠️ **Who is the XEN is decided by `assign shop-jobs`**, not by a column.
 * Whoever holds it at a shop is the XEN; everyone else posted to the shop is
 * an AE. A shop with two XENs works, and nothing has to be kept in step with
 * a supervisor_id that someone forgets to update when a person moves.
 *
 * ⚠️ **A shop with no XEN behaves exactly as it always did.** Nobody holding
 * the permission there means no gate, so a shop whose staff were never given
 * the role cannot wake up to an empty queue. Same deliberate shape as an
 * empty quotation approval chain.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $t) {
            if (! Schema::hasColumn('work_order_sections', 'assigned_to')) {
                // The AE who owns this job AT THIS SHOP. Null = still with the
                // XEN, or a shop that does not work this way.
                $t->foreignId('assigned_to')->nullable()->after('status')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('work_order_sections', 'assigned_by')) {
                $t->foreignId('assigned_by')->nullable()->after('assigned_to')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('work_order_sections', 'assigned_at')) {
                $t->timestamp('assigned_at')->nullable()->after('assigned_by');
            }
            // Stamped when the AE takes the job in hand. Until then the work
            // is handed over but not accepted, and those are different facts.
            if (! Schema::hasColumn('work_order_sections', 'received_at')) {
                $t->timestamp('received_at')->nullable()->after('assigned_at');
            }
            if (! Schema::hasColumn('work_order_sections', 'assign_note')) {
                $t->string('assign_note', 500)->nullable()->after('received_at');
            }
        });

        Permission::firstOrCreate(['name' => 'assign shop-jobs', 'guard_name' => 'web']);

        // The shop in-charge IS the XEN in BITAC's structure.
        Role::where('name', 'shop-incharge')->first()?->givePermissionTo('assign shop-jobs');

        // ⚠️ `super-admin` is deliberately not granted — Gate::before already
        // lets them past, and holding it would make them the XEN of every
        // shop for the purposes of the queue.

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::where('name', 'assign shop-jobs')->where('guard_name', 'web')->delete();

        foreach (['assigned_to', 'assigned_by'] as $column) {
            if (Schema::hasColumn('work_order_sections', $column)) {
                Schema::table('work_order_sections', fn (Blueprint $t) => $t->dropForeign([$column]));
            }
        }

        Schema::table('work_order_sections', function (Blueprint $t) {
            foreach (['assigned_to', 'assigned_by', 'assigned_at', 'received_at', 'assign_note'] as $column) {
                if (Schema::hasColumn('work_order_sections', $column)) {
                    $t->dropColumn($column);
                }
            }
        });
    }
};
