import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    pending:     'badge-amber',
    approved:    'badge-blue',
    rejected:    'badge-red',
    in_progress: 'badge-purple',
    completed:   'badge-green',
    cancelled:   'badge-slate',
};

const URGENCY_BADGE: Record<string, string> = {
    urgent: 'bg-rose-50 text-rose-700 border-rose-200',
    normal: 'bg-amber-50 text-amber-700 border-amber-200',
    low:    'bg-slate-50 text-slate-700 border-slate-200',
};

type Action = 'approve' | 'reject' | 'cancel' | 'complete' | null;

export default function MaintenanceShow({ request: r, can }: any) {
    const [action, setAction] = useState<Action>(null);

    const reviewForm = useForm({ review_notes: '' });
    const cancelForm = useForm({ cancellation_reason: '' });
    const startForm  = useForm({});
    const completeForm = useForm<{
        type: 'preventive' | 'corrective' | 'breakdown' | 'inspection' | 'overhaul';
        description: string;
        cost: string;
        downtime_hours: string;
        parts_replaced: string[];
        next_due_date: string;
        notes: string;
    }>({
        type: 'corrective',
        description: '',
        cost: '',
        downtime_hours: '',
        parts_replaced: [],
        next_due_date: '',
        notes: '',
    });

    const isPending    = r.status === 'pending';
    const isApproved   = r.status === 'approved';
    const isInProgress = r.status === 'in_progress';
    const isOver       = ['completed', 'rejected', 'cancelled'].includes(r.status);

    const submitReview = (mode: 'approve' | 'reject') => (e: FormEvent) => {
        e.preventDefault();
        reviewForm.post(`/maintenance-requests/${r.id}/${mode}`, {
            preserveScroll: true,
            onSuccess: () => { reviewForm.reset(); setAction(null); },
        });
    };

    const startWork = () => {
        if (!confirm('Start work on this machine? The machine will be flipped to maintenance state.')) return;
        startForm.post(`/maintenance-requests/${r.id}/start`, { preserveScroll: true });
    };

    const submitComplete = (e: FormEvent) => {
        e.preventDefault();
        completeForm.post(`/maintenance-requests/${r.id}/complete`, {
            preserveScroll: true,
            onSuccess: () => setAction(null),
        });
    };

    const submitCancel = (e: FormEvent) => {
        e.preventDefault();
        cancelForm.post(`/maintenance-requests/${r.id}/cancel`, {
            preserveScroll: true,
            onSuccess: () => { cancelForm.reset(); setAction(null); },
        });
    };

    const addPart = () => completeForm.setData('parts_replaced', [...(completeForm.data.parts_replaced ?? []), '']);
    const updatePart = (i: number, v: string) => {
        const next = [...completeForm.data.parts_replaced];
        next[i] = v;
        completeForm.setData('parts_replaced', next);
    };
    const removePart = (i: number) => completeForm.setData('parts_replaced',
        completeForm.data.parts_replaced.filter((_: any, idx: number) => idx !== i));

    return (
        <AppLayout header={`Maintenance Request #${r.id}`}>
            <div className="max-w-5xl space-y-6 animate-fade-in">

                {/* Header */}
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md text-white bg-gradient-to-br from-amber-400 to-amber-600">
                                <i className="fi fi-rr-wrench-simple text-xl leading-none" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-bold text-surface-900">Request #{r.id}</h1>
                                    <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status_label}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${URGENCY_BADGE[r.urgency]}`}>
                                        {r.urgency}
                                    </span>
                                </div>
                                <p className="text-sm text-surface-600 mt-1">
                                    Machine <strong>{r.machine?.machine_code ?? '—'}</strong>{r.machine?.name && <> — {r.machine.name}</>}
                                    {r.section && <> · {r.section}</>}
                                </p>
                                <p className="text-xs text-surface-400 mt-1">
                                    Reported by {r.requester?.name ?? '—'} on {r.created_at}
                                </p>
                            </div>
                        </div>
                        <Link href="/maintenance-requests" className="btn-ghost btn-sm shrink-0">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back to list
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: details */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Reported Problem</h3></div>
                            <div className="card-body">
                                <p className="text-sm text-surface-800 whitespace-pre-line leading-relaxed">{r.reported_problem}</p>
                                {r.expected_downtime_hours && (
                                    <p className="text-xs text-surface-500 mt-3 pt-3 border-t border-surface-100">
                                        <i className="fi fi-rr-clock text-[10px] leading-none mr-1" />
                                        Expected downtime: <strong>{r.expected_downtime_hours} hours</strong>
                                    </p>
                                )}
                            </div>
                        </div>

                        {r.attachment_urls && r.attachment_urls.length > 0 && (
                            <div className="card">
                                <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Photos</h3></div>
                                <div className="card-body grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {r.attachment_urls.map((u: string, i: number) => (
                                        <a key={i} href={u} target="_blank" rel="noreferrer">
                                            <img src={u} alt={`Photo ${i + 1}`}
                                                className="w-full h-28 object-cover rounded-lg border border-surface-200 hover:border-brand-400 transition-colors" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Decision panel — Pending */}
                        {isPending && can?.approve && !action && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Review</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Approve to authorise the work, or reject with reason.</p>
                                </div>
                                <div className="card-body flex flex-col sm:flex-row gap-3">
                                    <button onClick={() => setAction('approve')}
                                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-sm transition-all flex items-center justify-center gap-2">
                                        <i className="fi fi-rr-check text-xs leading-none" /> Approve
                                    </button>
                                    <button onClick={() => setAction('reject')}
                                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-2">
                                        <i className="fi fi-rr-cross text-xs leading-none" /> Reject
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Inline review form */}
                        {(action === 'approve' || action === 'reject') && (
                            <form onSubmit={submitReview(action)} className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">
                                        {action === 'approve' ? 'Approve request' : 'Reject request'}
                                    </h3>
                                </div>
                                <div className="card-body space-y-3">
                                    <div className="form-group">
                                        <label className="form-label">
                                            {action === 'approve' ? 'Approval note' : 'Reason'}
                                            {action === 'reject' && <span className="text-red-500"> *</span>}
                                        </label>
                                        <textarea value={reviewForm.data.review_notes}
                                            onChange={e => reviewForm.setData('review_notes', e.target.value)}
                                            rows={3}
                                            required={action === 'reject'}
                                            className="form-textarea"
                                            placeholder={action === 'approve' ? 'Optional context for the technician' : 'Explain why this request cannot be approved'} />
                                        {reviewForm.errors.review_notes && <p className="form-error">{reviewForm.errors.review_notes}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" disabled={reviewForm.processing}
                                            className={`btn-sm rounded-xl px-4 py-2 font-semibold text-white inline-flex items-center gap-1.5 ${
                                                action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                            } disabled:opacity-60`}>
                                            {reviewForm.processing ? 'Saving…' : `Confirm ${action}`}
                                        </button>
                                        <button type="button" onClick={() => { setAction(null); reviewForm.reset(); }} className="btn-ghost btn-sm">Cancel</button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Start Work — the requesting section coordinates handover */}
                        {isApproved && can?.perform && (
                            <div className="card border-blue-200 bg-blue-50/30">
                                <div className="card-body flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-blue-700">Approved &mdash; ready to start.</p>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            When your section is ready to release the machine to maintenance,
                                            click <strong>Start Work</strong>. The machine will flip to
                                            <span className="font-semibold"> maintenance</span> state.
                                        </p>
                                    </div>
                                    <button onClick={startWork} disabled={startForm.processing}
                                        className="btn-primary btn-sm">
                                        <i className="fi fi-rr-tools text-xs leading-none" /> Start Work
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Complete & Log */}
                        {isInProgress && can?.perform && action !== 'complete' && (
                            <div className="card border-purple-200 bg-purple-50/30">
                                <div className="card-body flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-purple-700">Work in progress.</p>
                                        <p className="text-xs text-surface-500 mt-0.5">Once done, log details so a maintenance record is created.</p>
                                    </div>
                                    <button onClick={() => setAction('complete')} className="btn-primary btn-sm">
                                        <i className="fi fi-rr-check-circle text-xs leading-none" /> Complete &amp; Log
                                    </button>
                                </div>
                            </div>
                        )}

                        {action === 'complete' && (
                            <form onSubmit={submitComplete} className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Complete maintenance</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Saves to the maintenance log + restores machine to idle.</p>
                                </div>
                                <div className="card-body space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="form-group">
                                            <label className="form-label">Type <span className="text-red-500">*</span></label>
                                            <select value={completeForm.data.type} onChange={e => completeForm.setData('type', e.target.value as any)} className="form-select">
                                                <option value="preventive">Preventive</option>
                                                <option value="corrective">Corrective</option>
                                                <option value="breakdown">Breakdown Fix</option>
                                                <option value="inspection">Inspection</option>
                                                <option value="overhaul">Overhaul</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Downtime <span className="form-label-optional">(hours)</span></label>
                                            <input type="number" min={0} step="0.25"
                                                value={completeForm.data.downtime_hours}
                                                onChange={e => completeForm.setData('downtime_hours', e.target.value)}
                                                className="form-input font-mono" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Cost <span className="form-label-optional">(৳)</span></label>
                                            <input type="number" min={0} step="0.01"
                                                value={completeForm.data.cost}
                                                onChange={e => completeForm.setData('cost', e.target.value)}
                                                className="form-input font-mono" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Next due date <span className="form-label-optional">(optional)</span></label>
                                            <input type="date"
                                                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                                                value={completeForm.data.next_due_date}
                                                onChange={e => completeForm.setData('next_due_date', e.target.value)}
                                                className="form-input" />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">What was done? <span className="text-red-500">*</span></label>
                                        <textarea value={completeForm.data.description}
                                            onChange={e => completeForm.setData('description', e.target.value)}
                                            rows={3}
                                            required
                                            placeholder="Diagnosed and fixed the root cause; replaced wear parts; calibrated…"
                                            className="form-textarea" />
                                        {completeForm.errors.description && <p className="form-error">{completeForm.errors.description}</p>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Parts replaced <span className="form-label-optional">(optional)</span></label>
                                        <div className="space-y-1.5">
                                            {(completeForm.data.parts_replaced ?? []).map((p, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input type="text" value={p}
                                                        onChange={e => updatePart(i, e.target.value)}
                                                        placeholder="e.g. Bearing 6203 ZZ"
                                                        className="form-input flex-1" />
                                                    <button type="button" onClick={() => removePart(i)}
                                                        className="btn-ghost btn-icon text-rose-600 hover:bg-rose-50">
                                                        <i className="fi fi-rr-cross-small text-xs leading-none" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={addPart} className="btn-ghost btn-xs">
                                                <i className="fi fi-rr-plus text-xs leading-none" /> Add part
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Notes <span className="form-label-optional">(optional)</span></label>
                                        <textarea value={completeForm.data.notes}
                                            onChange={e => completeForm.setData('notes', e.target.value)}
                                            rows={2}
                                            className="form-textarea" />
                                    </div>
                                </div>
                                <div className="card-body border-t border-surface-100 flex gap-2">
                                    <button type="submit" disabled={completeForm.processing} className="btn-primary">
                                        {completeForm.processing
                                            ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving…</>
                                            : <><i className="fi fi-rr-check text-sm" /> Confirm Completion</>}
                                    </button>
                                    <button type="button" onClick={() => setAction(null)} className="btn-ghost">Cancel</button>
                                </div>
                            </form>
                        )}

                        {/* Cancel form */}
                        {action === 'cancel' && (
                            <form onSubmit={submitCancel} className="card border-rose-100">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-rose-700">Cancel request</h3>
                                </div>
                                <div className="card-body space-y-3">
                                    <div className="form-group">
                                        <label className="form-label">Reason <span className="text-red-500">*</span></label>
                                        <textarea value={cancelForm.data.cancellation_reason}
                                            onChange={e => cancelForm.setData('cancellation_reason', e.target.value)}
                                            rows={3}
                                            required
                                            className="form-textarea"
                                            placeholder="Why this request is being cancelled" />
                                        {cancelForm.errors.cancellation_reason && <p className="form-error">{cancelForm.errors.cancellation_reason}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit" disabled={cancelForm.processing}
                                            className="btn-sm rounded-xl px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 inline-flex items-center gap-1.5 disabled:opacity-60">
                                            Confirm Cancel
                                        </button>
                                        <button type="button" onClick={() => { setAction(null); cancelForm.reset(); }} className="btn-ghost btn-sm">Keep open</button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Right: timeline */}
                    <aside className="space-y-4">
                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Status Timeline</h3></div>
                            <div className="card-body">
                                <ol className="space-y-3 text-sm">
                                    <TimelineStep
                                        done
                                        title="Submitted"
                                        subtitle={`by ${r.requester?.name ?? '—'}`}
                                        time={r.created_at}
                                        color="amber"
                                    />
                                    {(r.reviewed_at || isOver) && (
                                        <TimelineStep
                                            done={!!r.reviewed_at}
                                            title={r.status === 'rejected' ? 'Rejected' : 'Approved'}
                                            subtitle={r.reviewer ? `by ${r.reviewer}` : 'awaiting review'}
                                            time={r.reviewed_at}
                                            note={r.review_notes}
                                            color={r.status === 'rejected' ? 'rose' : 'blue'}
                                        />
                                    )}
                                    {r.started_at && (
                                        <TimelineStep done title="Started" subtitle={`by ${r.starter ?? '—'}`} time={r.started_at} color="purple" />
                                    )}
                                    {r.completed_at && (
                                        <TimelineStep done title="Completed" subtitle={`by ${r.completer ?? '—'}`} time={r.completed_at} color="emerald" />
                                    )}
                                    {r.cancelled_at && (
                                        <TimelineStep done title="Cancelled" subtitle={`by ${r.canceller ?? '—'}`} time={r.cancelled_at} note={r.cancellation_reason} color="slate" />
                                    )}
                                </ol>
                            </div>
                        </div>

                        {/* Cancel button */}
                        {!isOver && can?.cancel && !action && (
                            <button onClick={() => setAction('cancel')}
                                className="w-full btn-ghost text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                                <i className="fi fi-rr-cross-circle text-xs leading-none" /> Cancel request
                            </button>
                        )}

                        {r.maintenance_log_id && (
                            <div className="alert alert-success">
                                <i className="fi fi-rr-check-circle text-base leading-none" />
                                <div>
                                    <p className="font-semibold text-sm">Logged to maintenance history.</p>
                                    <p className="text-[11px] mt-0.5">Machine health metrics have been updated.</p>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function TimelineStep({ done, title, subtitle, time, note, color }: any) {
    const dotColor: Record<string, string> = {
        amber:   'bg-amber-500',
        blue:    'bg-blue-500',
        purple:  'bg-purple-500',
        emerald: 'bg-emerald-500',
        rose:    'bg-rose-500',
        slate:   'bg-slate-400',
    };
    return (
        <li className="flex gap-3">
            <div className={`w-3 h-3 mt-1 rounded-full shrink-0 ${done ? dotColor[color] ?? 'bg-surface-300' : 'bg-surface-200'}`} />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-surface-800">{title}</div>
                <div className="text-[11px] text-surface-500">{subtitle}{time && <> · {time}</>}</div>
                {note && <div className="text-xs text-surface-600 mt-1 italic">"{note}"</div>}
            </div>
        </li>
    );
}
