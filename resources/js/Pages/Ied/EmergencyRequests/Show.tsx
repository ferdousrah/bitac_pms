import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    pending:   'badge-amber',
    approved:  'badge-green',
    rejected:  'badge-red',
    cancelled: 'badge-slate',
};

export default function EmergencyRequestShow({ request: er }: any) {
    const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
    const form = useForm({ review_notes: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!mode) return;
        form.post(`/ied/emergency-requests/${er.id}/${mode}`, { preserveScroll: true });
    };

    const isPending = er.status === 'pending';

    return (
        <AppLayout header="Emergency Request">
            <div className="max-w-4xl space-y-6 animate-fade-in">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md text-white ${
                            er.status === 'approved' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                            er.status === 'rejected' ? 'bg-gradient-to-br from-rose-500 to-red-600' :
                                                       'bg-gradient-to-br from-amber-400 to-amber-600'
                        }`}>
                            <i className="fi fi-rr-siren-on text-base leading-none" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Emergency Request #{er.id}</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Raised {er.created_at}</p>
                        </div>
                    </div>
                    <Link href="/ied/emergency-requests" className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                    </Link>
                </div>

                {/* Status banner */}
                {er.status === 'approved' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
                        <i className="fi fi-rr-check-circle text-emerald-600 leading-none mt-0.5" />
                        <div className="flex-1 text-sm text-emerald-900">
                            <p className="font-semibold">Approved by {er.reviewer} on {er.reviewed_at}</p>
                            {er.review_notes && <p className="text-xs mt-1 text-emerald-800/80">"{er.review_notes}"</p>}
                            <p className="text-xs mt-1 text-emerald-800/80">
                                Job priority was lifted from <span className="font-mono">{er.original_priority}</span> to <span className="font-bold">urgent</span>. Production team has been notified.
                            </p>
                        </div>
                    </div>
                )}
                {er.status === 'rejected' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 flex items-start gap-3">
                        <i className="fi fi-rr-cross-circle text-rose-600 leading-none mt-0.5" />
                        <div className="flex-1 text-sm text-rose-900">
                            <p className="font-semibold">Rejected by {er.reviewer} on {er.reviewed_at}</p>
                            {er.review_notes && <p className="text-xs mt-1 text-rose-800/80">"{er.review_notes}"</p>}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Request details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="card">
                            <div className="card-header flex items-center justify-between">
                                <h3 className="text-sm font-bold text-surface-900">Request Details</h3>
                                <span className={`badge ${STATUS_BADGE[er.status]}`}>{er.status?.toUpperCase()}</span>
                            </div>
                            <div className="card-body space-y-3 text-sm">
                                {/* Target scope */}
                                {er.targetItem ? (
                                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <i className="fi fi-rr-box text-xs leading-none" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Targeted Item</div>
                                            <div className="text-sm font-mono font-bold text-indigo-900 mt-0.5">Job #{er.targetItem.job_number}</div>
                                            <div className="text-xs text-indigo-800/80 mt-0.5 truncate">
                                                {er.targetItem.product ?? 'Item'} · {Number(er.targetItem.quantity).toLocaleString('en-IN')} {er.targetItem.unit}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-surface-500">
                                        <i className="fi fi-rr-info text-[10px] leading-none mr-1" />
                                        Applies to <strong>the whole work order</strong> (no specific item flagged).
                                    </div>
                                )}

                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Reason</div>
                                    <p className="mt-1 text-surface-800 leading-relaxed whitespace-pre-line">{er.reason}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-100">
                                    <div>
                                        <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Needed By</div>
                                        <div className="mt-0.5 text-surface-900 font-medium">{er.needed_by ?? '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Contact</div>
                                        <div className="mt-0.5 text-surface-700">{er.requester_name}</div>
                                        {er.requester_contact && <div className="text-xs text-surface-400">{er.requester_contact}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Review form — pending only */}
                        {isPending && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Review</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        Approve to flip this job to <span className="font-semibold text-rose-600">URGENT</span> and notify the production team. Reject to send a polite decline with your reasoning back to the customer.
                                    </p>
                                </div>
                                <div className="card-body">
                                    {!mode && (
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button onClick={() => setMode('approve')}
                                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-sm transition-all flex items-center justify-center gap-2">
                                                <i className="fi fi-rr-check text-xs leading-none" /> Approve &amp; mark URGENT
                                            </button>
                                            <button onClick={() => setMode('reject')}
                                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-2">
                                                <i className="fi fi-rr-cross text-xs leading-none" /> Reject
                                            </button>
                                        </div>
                                    )}

                                    {mode && (
                                        <form onSubmit={submit} className="space-y-3">
                                            <div>
                                                <label className="form-label">
                                                    {mode === 'approve' ? 'Approval note' : 'Reason for rejection'}
                                                    {mode === 'reject' && <span className="text-red-500"> *</span>}
                                                </label>
                                                <textarea
                                                    value={form.data.review_notes}
                                                    onChange={e => form.setData('review_notes', e.target.value)}
                                                    rows={4}
                                                    required={mode === 'reject'}
                                                    placeholder={mode === 'approve'
                                                        ? 'Optional — anything to flag to the production team or customer'
                                                        : 'Explain why this cannot be expedited — capacity, materials, etc. Visible to the customer.'}
                                                    className="form-textarea"
                                                />
                                                {form.errors.review_notes && <p className="form-error">{form.errors.review_notes}</p>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button type="submit" disabled={form.processing}
                                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all ${
                                                        mode === 'approve'
                                                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500'
                                                            : 'bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500'
                                                    } disabled:opacity-60`}>
                                                    {form.processing ? 'Saving…' : mode === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                                                </button>
                                                <button type="button" onClick={() => { setMode(null); form.reset(); }}
                                                    className="btn-ghost btn-sm">Cancel</button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Work Order side panel */}
                    <aside className="space-y-4">
                        {er.workOrder && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Work Order</h3>
                                </div>
                                <div className="card-body space-y-3">
                                    <div>
                                        <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">WO Number</div>
                                        <Link href={`/work-orders/${er.workOrder.id}`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
                                            {er.workOrder.wo_number}
                                        </Link>
                                    </div>
                                    {er.workOrder.product && (
                                        <div>
                                            <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Product</div>
                                            <div className="text-sm text-surface-800">{er.workOrder.product}</div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <div className="text-[10px] font-semibold text-surface-400 uppercase">Quantity</div>
                                            <div className="font-mono text-surface-800">{er.workOrder.quantity}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-surface-400 uppercase">Priority</div>
                                            <div className={`font-bold uppercase ${
                                                er.workOrder.priority === 'urgent' ? 'text-rose-600' : 'text-surface-700'
                                            }`}>{er.workOrder.priority}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-surface-400 uppercase">Status</div>
                                            <div className="text-surface-800">{er.workOrder.status?.replace(/_/g, ' ')}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-surface-400 uppercase">Due</div>
                                            <div className="text-surface-700">{er.workOrder.due_date ?? '—'}</div>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-surface-100">
                                        <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Customer</div>
                                        <div className="text-sm text-surface-800">{er.workOrder.customer}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
