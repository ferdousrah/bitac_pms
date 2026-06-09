import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    accepted:  'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected:  'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPE_LABEL: Record<string, string> = {
    student: 'Student',
    consultancy: 'Consultancy Seeker',
    organization: 'Organization',
};

const MODE_LABEL: Record<string, string> = {
    in_person: 'In-person at BITAC',
    online: 'Online meeting',
    written: 'Written response',
};

export default function ConsultancyRequestShow({ cr, assignableUsers }: any) {
    const [action, setAction] = useState<null | 'accept' | 'reject' | 'complete'>(null);
    const acceptForm   = useForm({ response_notes: '', assigned_to: '' });
    const rejectForm   = useForm({ rejection_reason: '' });
    const completeForm = useForm({ response_notes: '' });

    const doAccept = (e: FormEvent) => {
        e.preventDefault();
        acceptForm.post(`/ied/consultancy-requests/${cr.id}/accept`, {
            onSuccess: () => setAction(null),
            preserveScroll: true,
        });
    };
    const doReject = (e: FormEvent) => {
        e.preventDefault();
        rejectForm.post(`/ied/consultancy-requests/${cr.id}/reject`, {
            onSuccess: () => setAction(null),
            preserveScroll: true,
        });
    };
    const doComplete = (e: FormEvent) => {
        e.preventDefault();
        completeForm.post(`/ied/consultancy-requests/${cr.id}/complete`, {
            onSuccess: () => setAction(null),
            preserveScroll: true,
        });
    };

    return (
        <AppLayout header={`Consultancy Request — ${cr.request_number}`}>
            <div className="max-w-4xl space-y-6 animate-fade-in">

                <Link href="/ied/consultancy-requests" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> All Requests
                </Link>

                {/* Header card */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                            <i className="fi fi-rr-graduation-cap text-xl leading-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-base font-bold text-indigo-600">{cr.request_number}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[cr.status]}`}>
                                    {cr.status}
                                </span>
                                <span className="inline-flex px-1.5 py-0.5 rounded-md bg-surface-100 text-surface-700 text-[9px] font-bold uppercase tracking-wider">
                                    {TYPE_LABEL[cr.requester_type] ?? cr.requester_type}
                                </span>
                            </div>
                            <h2 className="text-lg font-bold text-surface-900 mt-1">{cr.subject}</h2>
                            <p className="text-xs text-surface-400 mt-1">Submitted {cr.created_at} · Preferred mode: {MODE_LABEL[cr.preferred_mode]}</p>
                        </div>
                    </div>
                </div>

                {/* Contact details */}
                <div className="card">
                    <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Requester</h3></div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <Field label="Name"           value={cr.requester_name} />
                        <Field label="Email"          value={<a href={`mailto:${cr.requester_email}`} className="text-brand-600 hover:underline">{cr.requester_email}</a>} />
                        <Field label="Phone"          value={<a href={`tel:${cr.requester_phone}`} className="text-brand-600 hover:underline">{cr.requester_phone}</a>} />
                        <Field label={cr.requester_type === 'student' ? 'Institution' : 'Organization'} value={cr.organization_name ?? '—'} />
                        <Field label={cr.requester_type === 'student' ? 'Year / department' : 'Designation'} value={cr.designation_or_year ?? '—'} className="sm:col-span-2" />
                    </div>
                </div>

                {/* Description */}
                <div className="card">
                    <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Description</h3></div>
                    <div className="card-body">
                        <p className="text-sm text-surface-700 whitespace-pre-line">{cr.description}</p>
                        {cr.attachment_url && (
                            <a href={`/ied/consultancy-requests/${cr.id}/attachment`}
                                className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100">
                                <i className="fi fi-rr-paperclip text-[10px] leading-none" /> Download attachment
                            </a>
                        )}
                    </div>
                </div>

                {/* Decision panel */}
                {cr.status === 'pending' && !action && (
                    <div className="card border-indigo-200 bg-indigo-50/30">
                        <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-indigo-900">Decision</h3>
                                <p className="text-xs text-indigo-700/80 mt-0.5">Accept this request for BITAC to take forward, or reject with a reason.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAction('accept')} className="btn-success btn-sm">
                                    <i className="fi fi-rr-check-circle text-xs leading-none" /> Accept
                                </button>
                                <button onClick={() => setAction('reject')} className="btn-danger btn-sm">
                                    <i className="fi fi-rr-cross-circle text-xs leading-none" /> Reject
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Accept form */}
                {action === 'accept' && (
                    <form onSubmit={doAccept} className="card border-emerald-200">
                        <div className="card-header"><h3 className="text-sm font-bold text-emerald-800">Accept Request</h3></div>
                        <div className="card-body space-y-3">
                            <div className="form-group">
                                <label className="form-label">Assign to <span className="form-label-optional">optional</span></label>
                                <select value={acceptForm.data.assigned_to}
                                    onChange={e => acceptForm.setData('assigned_to', e.target.value)}
                                    className="form-select">
                                    <option value="">Not assigned</option>
                                    {assignableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes to requester <span className="form-label-optional">included in the email</span></label>
                                <textarea value={acceptForm.data.response_notes}
                                    onChange={e => acceptForm.setData('response_notes', e.target.value)}
                                    rows={3} placeholder="Optional message — e.g. when they can expect a follow-up call"
                                    className="form-textarea" />
                            </div>
                        </div>
                        <div className="card-body border-t border-surface-100 flex items-center gap-2">
                            <button type="submit" disabled={acceptForm.processing} className="btn-success btn-sm">
                                <i className="fi fi-rr-check text-xs leading-none" /> Confirm Accept
                            </button>
                            <button type="button" onClick={() => setAction(null)} className="btn-ghost btn-sm">Cancel</button>
                        </div>
                    </form>
                )}

                {/* Reject form */}
                {action === 'reject' && (
                    <form onSubmit={doReject} className="card border-rose-200">
                        <div className="card-header"><h3 className="text-sm font-bold text-rose-800">Reject Request</h3></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                                <textarea value={rejectForm.data.rejection_reason}
                                    onChange={e => rejectForm.setData('rejection_reason', e.target.value)}
                                    rows={4} required
                                    placeholder="Explain why this request can't be taken forward. This will be included in the email to the requester."
                                    className="form-textarea" />
                                {rejectForm.errors.rejection_reason && <p className="form-error">{rejectForm.errors.rejection_reason as any}</p>}
                            </div>
                        </div>
                        <div className="card-body border-t border-surface-100 flex items-center gap-2">
                            <button type="submit" disabled={rejectForm.processing} className="btn-danger btn-sm">
                                <i className="fi fi-rr-cross text-xs leading-none" /> Confirm Reject
                            </button>
                            <button type="button" onClick={() => setAction(null)} className="btn-ghost btn-sm">Cancel</button>
                        </div>
                    </form>
                )}

                {/* Mark Complete (for accepted) */}
                {cr.status === 'accepted' && !action && (
                    <div className="card border-blue-200 bg-blue-50/30">
                        <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-blue-900">Accepted — In Progress</h3>
                                <p className="text-xs text-blue-700/80 mt-0.5">
                                    Accepted on {cr.reviewed_at} by {cr.reviewed_by ?? '—'}
                                    {cr.assigned_to && <> · assigned to <strong>{cr.assigned_to.name}</strong></>}
                                </p>
                            </div>
                            <button onClick={() => setAction('complete')} className="btn-primary btn-sm">
                                <i className="fi fi-rr-flag-alt text-xs leading-none" /> Mark Completed
                            </button>
                        </div>
                    </div>
                )}

                {action === 'complete' && (
                    <form onSubmit={doComplete} className="card border-emerald-200">
                        <div className="card-header"><h3 className="text-sm font-bold text-emerald-800">Mark as Completed</h3></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Closing notes <span className="form-label-optional">optional</span></label>
                                <textarea value={completeForm.data.response_notes}
                                    onChange={e => completeForm.setData('response_notes', e.target.value)}
                                    rows={3} placeholder="What was provided? Summary for the audit trail + included in the email."
                                    className="form-textarea" />
                            </div>
                        </div>
                        <div className="card-body border-t border-surface-100 flex items-center gap-2">
                            <button type="submit" disabled={completeForm.processing} className="btn-success btn-sm">
                                <i className="fi fi-rr-check text-xs leading-none" /> Confirm Complete
                            </button>
                            <button type="button" onClick={() => setAction(null)} className="btn-ghost btn-sm">Cancel</button>
                        </div>
                    </form>
                )}

                {/* Audit trail */}
                {(cr.status !== 'pending' || cr.response_notes || cr.rejection_reason) && (
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Audit Trail</h3></div>
                        <div className="card-body space-y-3 text-sm">
                            {cr.reviewed_at && (
                                <Audit color="blue" icon="fi-rr-eye"
                                    title={`Reviewed — ${cr.status === 'rejected' ? 'Rejected' : 'Accepted'}`}
                                    sub={`by ${cr.reviewed_by ?? '—'} on ${cr.reviewed_at}`}
                                    body={cr.status === 'rejected' ? cr.rejection_reason : cr.response_notes} />
                            )}
                            {cr.completed_at && (
                                <Audit color="emerald" icon="fi-rr-flag-alt"
                                    title="Completed"
                                    sub={`by ${cr.completed_by ?? '—'} on ${cr.completed_at}`}
                                    body={cr.response_notes} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function Field({ label, value, className = '' }: any) {
    return (
        <div className={className}>
            <dt className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{label}</dt>
            <dd className="text-sm text-surface-900 mt-0.5 break-words">{value}</dd>
        </div>
    );
}

function Audit({ color, icon, title, sub, body }: any) {
    const colors: Record<string, string> = {
        blue:    'bg-blue-50 text-blue-700 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose:    'bg-rose-50 text-rose-700 border-rose-100',
    };
    return (
        <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}>
                <i className={`fi ${icon} text-sm leading-none`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-surface-900">{title}</div>
                <div className="text-xs text-surface-500 mt-0.5">{sub}</div>
                {body && (
                    <div className="mt-2 bg-surface-50 border border-surface-100 rounded-lg px-3 py-2 text-xs text-surface-700 whitespace-pre-line">{body}</div>
                )}
            </div>
        </div>
    );
}
