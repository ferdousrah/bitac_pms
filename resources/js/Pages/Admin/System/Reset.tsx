import AppLayout from '@/Layouts/AppLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface Props {
    counts: Record<string, number | null>;
}

// Human-readable groupings for the "what will be wiped" panel. Pure UI grouping
// — controller deletes by its own ordered list. Keeps the warning meaningful
// instead of dumping raw table names.
const GROUPS: { label: string; tables: string[] }[] = [
    {
        label: 'RFQs & Letters',
        tables: ['rfqs', 'rfq_items', 'rfq_item_parts', 'rfq_item_files', 'rfq_letters', 'rfq_automation_logs'],
    },
    {
        label: 'Cost Estimates',
        tables: ['cost_estimates', 'cost_estimate_lines', 'cost_estimate_approvals'],
    },
    {
        label: 'Quotations',
        tables: ['quotations', 'quotation_items', 'quotation_files', 'quotation_approvals', 'customer_responses'],
    },
    {
        label: 'Jobs / Work Orders',
        tables: ['work_orders', 'work_order_items', 'work_order_sections', 'work_order_files', 'material_requisitions', 'material_requisition_items', 'material_requisition_notes'],
    },
    {
        label: 'Operation Sheets & Production',
        tables: ['operation_sheets', 'operation_steps', 'operator_assignments', 'production_schedules', 'job_executions', 'section_handoffs', 'section_handoff_files', 'production_messages', 'production_message_files', 'downtime_events'],
    },
    {
        label: 'QC, NCR & Rework',
        tables: ['qc_inspections', 'qc_checklist_items', 'ncrs', 'rework_orders'],
    },
    {
        label: 'Delivery, Billing & Certificates',
        tables: ['delivery_orders', 'proof_of_deliveries', 'invoices', 'completion_certificates'],
    },
    {
        label: 'Gate Passes',
        tables: ['gate_passes', 'gate_pass_items', 'gate_pass_condition_notes'],
    },
    {
        label: 'Feedback & Service Requests',
        tables: ['customer_complaints', 'complaint_discussions', 'complaint_decision_makers', 'emergency_requests', 'consultancy_requests', 'service_demand_logs', 'maintenance_requests'],
    },
    {
        label: 'Stakeholder Form Responses',
        tables: ['stakeholder_form_responses', 'stakeholder_form_answers', 'stakeholder_form_invitations', 'stakeholders'],
    },
    {
        label: 'Notifications & Audit Trail',
        tables: ['notifications', 'customer_notifications', 'entity_comments', 'entity_revisions'],
    },
];

const PRESERVED = [
    { label: 'Users / Roles / Permissions', icon: 'fi-rr-users' },
    { label: 'Customers', icon: 'fi-rr-building' },
    { label: 'Products / BOMs', icon: 'fi-rr-cube' },
    { label: 'Master Data — Sections, Machines, Operators, Materials, Operations', icon: 'fi-rr-sitemap' },
    { label: 'Portfolio projects + photos', icon: 'fi-rr-images' },
    { label: 'System settings — Branding, Centers, Chatbot', icon: 'fi-rr-settings' },
];

export default function SystemReset({ counts }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/admin/system/reset', { preserveScroll: true });
    };

    const groupTotal = (tables: string[]) =>
        tables.reduce((sum, t) => sum + (counts[t] ?? 0), 0);

    const grandTotal = Object.values(counts).reduce((s: number, v) => s + (v ?? 0), 0);

    return (
        <AppLayout header="System Reset">
            <div className="max-w-4xl space-y-6 animate-fade-in">
                {/* Warning banner */}
                <div className="rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-rose-50 p-5">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-md">
                            <i className="fi fi-rr-triangle-warning text-xl leading-none" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-red-900">Wipe Sample / Transactional Data</h1>
                            <p className="text-sm text-red-800 mt-1 leading-relaxed">
                                This permanently deletes <strong>all RFQs, Cost Estimates, Quotations, Jobs, Operation Sheets,
                                Material Requisitions, Deliveries, Invoices, QC records, NCRs, notifications, and audit comments</strong> —
                                plus all uploaded files (drawings, sample photos, signatures, PDFs).
                            </p>
                            <p className="text-sm text-red-800 mt-2 leading-relaxed">
                                Use this after a demo to start fresh with real BITAC work. <strong>Cannot be undone.</strong>
                                Take a database backup first.
                            </p>
                        </div>
                    </div>
                </div>

                {/* What WILL be wiped */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <i className="fi fi-rr-trash text-red-500" />
                            <h3 className="text-sm font-bold text-surface-900">Will be wiped</h3>
                            <span className="badge badge-red">{grandTotal} rows total</span>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {GROUPS.map(g => {
                                const total = groupTotal(g.tables);
                                return (
                                    <div key={g.label} className="p-3 rounded-xl border border-surface-100 bg-surface-50/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-sm font-bold text-surface-900">{g.label}</div>
                                            <span className={`text-xs font-bold font-mono ${total > 0 ? 'text-red-600' : 'text-surface-400'}`}>
                                                {total} {total === 1 ? 'row' : 'rows'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-surface-400 font-mono">
                                            {g.tables.filter(t => counts[t] !== null).join(', ')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* What WILL be preserved */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <i className="fi fi-rr-shield-check text-emerald-500" />
                            <h3 className="text-sm font-bold text-surface-900">Will be preserved</h3>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {PRESERVED.map(p => (
                                <div key={p.label} className="flex items-center gap-2 text-sm text-surface-700">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                        <i className={`fi ${p.icon} text-xs leading-none`} />
                                    </div>
                                    {p.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Confirmation form */}
                <form onSubmit={submit} className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Confirm</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            Type <code className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-mono font-bold">DELETE ALL</code> below to enable the wipe button. There is no undo.
                        </p>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="form-group">
                            <label className="form-label">Type the phrase exactly:</label>
                            <input
                                type="text"
                                value={data.confirmation}
                                onChange={e => setData('confirmation', e.target.value)}
                                className="form-input font-mono"
                                placeholder="DELETE ALL"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            {errors.confirmation && (
                                <p className="form-error">{errors.confirmation}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <a href="/dashboard" className="btn-ghost">Cancel</a>
                            <button
                                type="submit"
                                disabled={processing || data.confirmation.trim() !== 'DELETE ALL' || grandTotal === 0}
                                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 shadow-md transition-colors disabled:bg-surface-300 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <i className="fi fi-rr-trash text-xs leading-none mr-1.5" />
                                {processing ? 'Wiping…' : grandTotal === 0 ? 'Nothing to wipe' : `Wipe ${grandTotal} rows + files`}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
