import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

const STATUS_BADGE: Record<string, string> = {
    open:      'badge-amber',
    in_review: 'badge-blue',
    resolved:  'badge-green',
    closed:    'badge-slate',
};

const CATEGORY_LABEL: Record<string, string> = {
    general: 'General Feedback',
    quality: 'Quality Issue',
    delivery: 'Delivery Issue',
    billing: 'Billing / Invoice Issue',
    other: 'Other',
};

export default function IedComplaintShow({ complaint }: any) {
    const isResolved = ['resolved', 'closed'].includes(complaint.status);
    const hasResponse = !!complaint.response;

    const form = useForm({
        response: complaint.response ?? '',
        status: complaint.status === 'open' ? 'in_review' : (complaint.status === 'in_review' ? 'resolved' : complaint.status),
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/ied/complaints/${complaint.id}/respond`);
    };

    const setStatusOnly = (status: string) => {
        const f = useForm({ status }) as any;
        f.post(`/ied/complaints/${complaint.id}/status`);
    };

    return (
        <AppLayout header={`Complaint — ${complaint.reference_number}`}>
            <div className="space-y-6 animate-fade-in max-w-5xl">
                {/* Header card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Complaint</div>
                                <h2 className="text-xl font-bold font-mono text-rose-600 mt-1">{complaint.reference_number}</h2>
                                <p className="text-surface-800 text-base font-semibold mt-2">{complaint.subject}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                                    <span><i className="fi fi-rr-tag-alt text-[10px]" /> {CATEGORY_LABEL[complaint.category] ?? complaint.category}</span>
                                    <span><i className="fi fi-rr-calendar text-[10px]" /> {complaint.created_at}</span>
                                </div>
                            </div>
                            <span className={`badge ${STATUS_BADGE[complaint.status] ?? 'badge-slate'}`}>
                                {String(complaint.status).replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer message */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Customer's Message</h3>
                                <p className="text-xs text-surface-400 mt-0.5">As filed by the customer</p>
                            </div>
                            <div className="card-body">
                                <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed bg-surface-50/70 border border-surface-100 rounded-xl px-4 py-3">
                                    {complaint.message}
                                </div>
                            </div>
                        </div>

                        {/* Existing response (if any) */}
                        {hasResponse && (
                            <div className="card border-emerald-300 overflow-hidden">
                                <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-comment-check text-base leading-none" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Sent Response</span>
                                    </div>
                                    <span className="text-[11px] text-white/90">{complaint.responded_at}</span>
                                </div>
                                <div className="card-body space-y-2">
                                    <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed">
                                        {complaint.response}
                                    </div>
                                    {complaint.responded_by && (
                                        <div className="text-[11px] text-surface-500 italic">— {complaint.responded_by}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Response form */}
                        <form onSubmit={submit} className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">
                                    {hasResponse ? 'Update Response' : 'Send Response'}
                                </h3>
                                <p className="text-xs text-surface-400 mt-0.5">The customer will see this on their portal.</p>
                            </div>
                            <div className="card-body space-y-4">
                                <div className="form-group">
                                    <label className="form-label">Your reply <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={form.data.response}
                                        onChange={(e) => form.setData('response', e.target.value)}
                                        rows={6}
                                        className="form-input"
                                        style={{ resize: 'vertical' }}
                                        placeholder="Acknowledge the issue, explain the action taken, give a timeline if relevant."
                                    />
                                    {form.errors.response && <p className="form-error">{form.errors.response}</p>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Set Status <span className="text-red-500">*</span></label>
                                    <select
                                        value={form.data.status}
                                        onChange={(e) => form.setData('status', e.target.value as any)}
                                        className="form-select"
                                    >
                                        <option value="in_review">In Review — investigating, will revert</option>
                                        <option value="resolved">Resolved — issue addressed</option>
                                        <option value="closed">Closed — no further action</option>
                                    </select>
                                </div>
                            </div>
                            <div className="card-footer flex items-center justify-end gap-2">
                                <Link href="/ied/complaints" className="btn-outline">Cancel</Link>
                                <button
                                    type="submit"
                                    disabled={form.processing || !form.data.response.trim()}
                                    className="btn-primary"
                                >
                                    {form.processing ? (
                                        <><i className="fi fi-rr-spinner animate-spin text-sm" /> Sending...</>
                                    ) : (
                                        <><i className="fi fi-rr-paper-plane text-sm" /> Send & Update Status</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        {/* Customer info */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Customer</h3>
                            </div>
                            <div className="card-body space-y-2 text-sm">
                                <div>
                                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Name</div>
                                    <div className="font-semibold text-surface-900 mt-0.5">{complaint.customer?.name ?? '—'}</div>
                                </div>
                                {complaint.customer?.email && (
                                    <div>
                                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Email</div>
                                        <a href={`mailto:${complaint.customer.email}`} className="text-brand-600 hover:underline">{complaint.customer.email}</a>
                                    </div>
                                )}
                                {complaint.customer?.phone && (
                                    <div>
                                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Phone</div>
                                        <div className="text-surface-800 mt-0.5 font-mono">{complaint.customer.phone}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Related job */}
                        {complaint.work_order && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Related Job</h3>
                                </div>
                                <div className="card-body space-y-2 text-sm">
                                    <div>
                                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Job</div>
                                        <Link href={`/work-orders/${complaint.work_order.id}`} className="font-bold text-brand-600 hover:underline text-base">
                                            Job #{complaint.work_order.job_number ?? '—'}
                                        </Link>
                                        <div className="text-[11px] text-surface-400 font-mono mt-0.5">{complaint.work_order.wo_number}</div>
                                    </div>
                                    {complaint.work_order.product && (
                                        <div>
                                            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Product</div>
                                            <div className="text-surface-800 mt-0.5">{complaint.work_order.product}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Back link */}
                        <Link href="/ied/complaints" className="btn-outline btn-sm w-full justify-center">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" />
                            All Complaints
                        </Link>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
