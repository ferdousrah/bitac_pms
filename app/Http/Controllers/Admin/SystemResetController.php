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
     *
     * ⚠️ FOREIGN_KEY_CHECKS is switched off for the wipe, which also switches
     * off ON DELETE CASCADE. A child table that is not listed here is NOT
     * cleared with its parent — it is left behind pointing at nothing. Every
     * transactional table has to be named.
     */
    private const TABLES_TO_WIPE = [
        // Notifications / audit / comments — touch many entities, wipe first
        'notifications',
        'customer_notifications',
        'chat_reads',
        'material_demand_items',
        'material_demands',
        'chat_message_files',
        'chat_messages',
        'entity_comments',
        'entity_revisions',
        // Who-did-what — it would only point at rows wiped below.
        'audit_logs',
        'ims_integration_logs',

        // Meetings and the conversations with Oli are activity, not setup.
        // The AI usage/cost log (ai_usage_logs) is KEPT — it records real
        // API spending.
        'meeting_action_items',
        'meeting_decisions',
        'meeting_messages',
        'meeting_topics',
        'meeting_participants',
        'meetings',
        'ai_messages',
        'ai_conversations',

        // Delivery + billing + completion certificates
        'completion_certificates',
        'proof_of_deliveries',
        'delivery_order_items',
        'delivery_orders',
        // The payment ledger goes with the bills it settled. Its TYPES are
        // master data (payment_deduction_types) and are preserved.
        'payment_files',
        'payment_deductions',
        'payments',
        'invoices',

        // QC / NCRs / rework
        'qc_checklist_items',
        'qc_inspections',
        'ncrs',
        'rework_orders',

        // Production execution
        'production_message_files',
        'production_messages',
        'section_handoff_files',
        'section_handoffs',
        'downtime_events',
        'job_executions',
        'production_schedules',
        // ⚠️ The daily output logged against every operation. It was missing,
        // and FK checks are OFF below, so its ON DELETE CASCADE never fired:
        // the logs outlived their jobs and kept feeding the production reports.
        'production_logs',
        'operator_assignments',
        'operation_steps',
        'operation_sheets',

        // Work Order chain
        'material_requisition_notes',
        'material_requisition_items',
        'material_requisitions',
        'work_order_files',
        'work_order_items',
        'work_order_sections',
        // The IED acceptance chain — missing too, for the same reason.
        'work_order_approvals',
        'work_orders',

        // Gate passes (IED)
        'gate_pass_condition_notes',
        'gate_pass_items',
        'gate_pass_returns',
        'gate_passes',

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

        'musak_challan_items',
        'musak_challans',

        // RFQ chain
        'office_note_approvals',
        'office_notes',
        'rfq_letters',
        'rfq_automation_logs',
        'rfq_item_parts',
        'rfq_item_files',
        'rfq_items',
        'rfqs',

        // Customer feedback / complaints
        'complaint_discussions',
        'complaint_decision_makers',
        'customer_complaints',

        // Standalone transactional requests / logs
        'emergency_requests',
        'consultancy_requests',
        'quotation_request_files',
        'quotation_requests',
        'factory_visits',
        'letter_registers',
        'service_demand_logs',
        'maintenance_requests',
        'machine_maintenance_logs',

        // Stakeholder form submissions (form/section/question TEMPLATES are kept)
        'stakeholder_form_answers',
        'stakeholder_form_responses',
        'stakeholder_form_invitations',
    ];

    /**
     * Storage directories scrubbed when wiping (relative to the public disk).
     * Anything not under these dirs (logos, portfolio, etc.) is left alone.
     */
    private const STORAGE_DIRS_TO_WIPE = [
        'rfqs', 'rfq-items', 'rfq-letters', 'cost-estimates',
        'quotations', 'work-orders', 'work-order-files',
        'section-handoffs', 'production-messages',
        'customer-responses', 'completion-certificates',
        'consultancy-requests', 'maintenance-requests',
        // Signatures DRAWN on a document. ⚠️ Only these sub-folders — the
        // people's own saved signature blocks live directly in `signatures/`
        // and must survive.
        'signatures/approvals', 'signatures/estimate-approvals', 'signatures/gate-passes',
        'signatures/work-orders', 'signatures/letters', 'signatures/notes',
        'signatures/invoices', 'signatures/invoice-letters', 'signatures/musak', 'signatures/challans',
        'pod',                 // delivery receivers' signatures
        'payments',
        'meeting-uploads', 'ai-reports',
    ];

    /**
     * Same, on the PRIVATE (local) disk — uploads from the public website,
     * which are never served without a sign-in.
     */
    private const PRIVATE_STORAGE_DIRS_TO_WIPE = [
        'quotation-requests',
        'chat',
        'letter-registers',
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
            // A machine in the middle of a maintenance request was put into
            // `maintenance` by it, and only completing or cancelling the request
            // takes it out — so read where each one was BEFORE the requests go.
            $inMaintenance = \Schema::hasTable('maintenance_requests')
                ? DB::table('maintenance_requests')->where('status', 'in_progress')->whereNotNull('machine_id')
                    ->pluck('machine_state_before', 'machine_id')
                : collect();

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

            // The machines are kept; the work that set their state is gone.
            // `running` means "has an operation in progress" — there are none
            // now. A machine held in maintenance by a request just wiped goes
            // back to where it was. Breakdown / offline / setup set by hand stay.
            if (\Schema::hasTable('machines')) {
                DB::table('machines')->where('current_state', 'running')
                    ->update(['current_state' => 'idle', 'state_changed_at' => now()]);
                foreach ($inMaintenance as $machineId => $before) {
                    DB::table('machines')->where('id', $machineId)->where('current_state', 'maintenance')
                        ->update(['current_state' => $before ?: 'idle', 'state_changed_at' => now()]);
                }
            }
        });

        // Storage clean-up — files from these dirs are no longer referenced by
        // any row, so we can drop the directories entirely.
        foreach (self::STORAGE_DIRS_TO_WIPE as $dir) {
            if (Storage::disk('public')->exists($dir)) {
                Storage::disk('public')->deleteDirectory($dir);
            }
        }
        foreach (self::PRIVATE_STORAGE_DIRS_TO_WIPE as $dir) {
            if (Storage::disk('local')->exists($dir)) {
                Storage::disk('local')->deleteDirectory($dir);
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
