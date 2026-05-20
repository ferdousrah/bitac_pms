<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Sample-data reset / clean-slate tool.
 *
 * Wipes all TRANSACTIONAL data (RFQs onwards) while keeping master data,
 * customers, products, users, portfolio, and system settings intact —
 * so the org can flip from demo to production without dropping the DB.
 *
 * Super-admin only. Confirmation phrase required to prevent accidents.
 */
class SystemResetController extends Controller
{
    /**
     * Tables wiped, in FK-safe order (children first). Any table not present
     * on this DB is silently skipped, so the list is safe to extend over time.
     */
    private const TABLES_TO_WIPE = [
        // Notifications / audit / comments — touch many entities, wipe first
        'notifications',
        'entity_comments',
        'entity_revisions',

        // Delivery + billing
        'proof_of_deliveries',
        'delivery_orders',
        'invoices',

        // QC / NCRs
        'qc_inspections',
        'ncrs',

        // Production execution
        'job_executions',
        'production_schedules',
        'operator_assignments',
        'operation_steps',
        'operation_sheets',

        // Work Order chain
        'material_requisition_items',
        'material_requisitions',
        'work_order_files',
        'work_order_sections',
        'work_orders',

        // Quotation chain
        'customer_responses',
        'quotation_files',
        'quotation_approvals',
        'quotation_items',
        'quotations',

        // Cost Estimate chain
        'cost_estimate_approvals',
        'cost_estimate_lines',
        'cost_estimates',

        // RFQ chain
        'rfq_item_files',
        'rfq_items',
        'rfqs',
    ];

    /**
     * Storage directories scrubbed when wiping (relative to the public disk).
     * Anything not under these dirs (logos, portfolio, etc.) is left alone.
     */
    private const STORAGE_DIRS_TO_WIPE = [
        'rfqs', 'cost-estimates', 'quotations', 'work-orders',
        'customer-responses', 'signatures/approvals',
    ];

    public function index(Request $request)
    {
        $this->guardSuperAdmin();

        // Show row counts so the operator knows what they're about to wipe.
        $counts = [];
        foreach (self::TABLES_TO_WIPE as $table) {
            $counts[$table] = \Schema::hasTable($table)
                ? (int) DB::table($table)->count()
                : null;
        }

        return Inertia::render('Admin/System/Reset', [
            'counts' => $counts,
        ]);
    }

    public function wipe(Request $request)
    {
        $this->guardSuperAdmin();

        // Type-to-confirm — operator has to literally type the phrase before submit.
        $request->validate([
            'confirmation' => 'required|string',
        ]);

        if (trim($request->input('confirmation')) !== 'DELETE ALL') {
            return back()->withErrors([
                'confirmation' => 'Type "DELETE ALL" exactly to confirm.',
            ]);
        }

        DB::transaction(function () {
            // Disable FK checks so we don't have to hand-order EVERY child table.
            // Re-enabled at the end. Wrapped in transaction so a mid-wipe failure
            // rolls back the whole thing.
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            try {
                foreach (self::TABLES_TO_WIPE as $table) {
                    if (\Schema::hasTable($table)) {
                        DB::table($table)->delete();
                    }
                }
            } finally {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        });

        // Storage clean-up — files from these dirs are no longer referenced by
        // any row, so we can drop the directories entirely.
        foreach (self::STORAGE_DIRS_TO_WIPE as $dir) {
            if (Storage::disk('public')->exists($dir)) {
                Storage::disk('public')->deleteDirectory($dir);
            }
        }

        return redirect()->route('admin.system.reset.index')
            ->with('success', 'All transactional data has been wiped. The system is back to a clean slate. Master data, customers, products, portfolio, and users are preserved.');
    }

    private function guardSuperAdmin(): void
    {
        $user = auth()->user();
        $isSuperAdmin = $user && method_exists($user, 'hasRole')
            && ($user->hasRole('super-admin') || $user->hasRole('super_admin'));

        abort_unless($isSuperAdmin, 403, 'Only super-admin can wipe sample data.');
    }
}
