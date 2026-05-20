import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';

const STATUS_BADGE: Record<string, string> = {
    pcd_pending:       'badge-amber',
    released_to_shops: 'badge-green',
    cancelled:         'badge-red',
};

const PRIORITY_BADGE: Record<string, string> = {
    low:    'badge-slate',
    normal: 'badge-blue',
    high:   'badge-amber',
    urgent: 'badge-red',
};

export default function PcdInbox({ jobs, stats }: any) {
    const [cancelJob, setCancelJob] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const openCancel = (job: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCancelJob(job);
        setReason('');
        setAttachments([]);
    };

    const closeModal = () => {
        if (submitting) return;
        setCancelJob(null);
        setReason('');
        setAttachments([]);
    };

    const submitCancel = () => {
        if (!cancelJob || reason.trim().length < 3) return;
        setSubmitting(true);
        const form = new FormData();
        form.append('reason', reason);
        attachments.forEach((f) => form.append('attachments[]', f));
        router.post(`/pcd/inbox/${cancelJob.id}/cancel`, form, {
            preserveScroll: true,
            forceFormData: true,
            onFinish: () => {
                setSubmitting(false);
                setCancelJob(null);
                setReason('');
                setAttachments([]);
            },
        });
    };

    const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        setAttachments((prev) => [...prev, ...files]);
        e.target.value = '';
    };

    const removeFile = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx));

    return (
        <AppLayout header="PCD Inbox">
            <div className="space-y-6 animate-fade-in">

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatTile label="Total Jobs" value={stats.total} icon="fi-rr-clipboard-list" color="blue" />
                    <StatTile label="Pending PCD" value={stats.pending} icon="fi-rr-time-check" color="amber" />
                    <StatTile label="Released to Shops" value={stats.released} icon="fi-rr-check-circle" color="green" />
                    <StatTile label="MR Pending" value={stats.mr_pending} icon="fi-rr-document" color="red" />
                    <StatTile label="Closed" value={stats.cancelled ?? 0} icon="fi-rr-cross-circle" color="rose" />
                </div>

                {/* Jobs */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">PCD Job Queue</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Jobs handed off from IED awaiting PCD processing</p>
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {jobs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-inbox" /></div>
                                <div className="empty-state-title">No jobs in PCD inbox</div>
                                <div className="empty-state-text">Jobs will appear here once IED issues a Work Order from an accepted quotation.</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {jobs.map((job: any) => {
                                    const isClosed = job.status === 'cancelled';
                                    return (
                                    <div key={job.id} className={`relative ${isClosed ? 'bg-rose-50/40' : ''}`}>
                                        <Link href={`/pcd/inbox/${job.id}`}
                                            className={`block px-5 py-4 transition-colors ${isClosed ? 'opacity-80' : 'hover:bg-brand-50/30'}`}>
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${isClosed ? 'bg-rose-300' : 'bg-gradient-to-br from-brand-400 to-brand-600'}`}>
                                                    {job.job_number ?? '#'}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`font-mono text-xs font-semibold ${isClosed ? 'line-through text-surface-500' : 'text-surface-700'}`}>{job.wo_number}</span>
                                                        <JobTypeBadge type={job.job_type} size="xs" />
                                                        <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-slate'}`}>{job.status?.replace(/_/g, ' ')}</span>
                                                        {!isClosed && (
                                                            <span className={`badge ${PRIORITY_BADGE[job.priority] ?? 'badge-slate'} capitalize`}>{job.priority}</span>
                                                        )}
                                                    </div>
                                                    <h3 className={`text-sm font-semibold mt-1 ${isClosed ? 'text-surface-500' : 'text-surface-900'}`}>{job.customer}</h3>
                                                    {job.customer_po_no && (
                                                        <p className="text-xs text-surface-400 mt-0.5">PO: <span className="font-mono">{job.customer_po_no}</span></p>
                                                    )}
                                                    {isClosed ? (
                                                        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-rose-100/70 border border-rose-200 text-xs text-rose-800">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <i className="fi fi-rr-cross-circle text-[11px]" />
                                                                <span className="font-semibold">Closed</span>
                                                                {job.cancelled_at && <span>· {job.cancelled_at}</span>}
                                                                {job.cancelled_by && <span>· by {job.cancelled_by}</span>}
                                                            </div>
                                                            {job.cancellation_reason && (
                                                                <div className="mt-1 text-rose-900/80 line-clamp-2">{job.cancellation_reason}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                                                            <span><i className="fi fi-rr-boxes text-[10px]" /> {job.item_count} items</span>
                                                            <span><i className="fi fi-rr-cube text-[10px]" /> qty {job.quantity}</span>
                                                            {job.due_date && <span><i className="fi fi-rr-calendar text-[10px]" /> {job.due_date}</span>}
                                                            <span className="text-surface-400">· handed off {job.pcd_handoff_at}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Checklist progress (hidden for closed jobs) */}
                                                {!isClosed && (
                                                    <div className="hidden lg:flex items-center gap-2 shrink-0 pr-32">
                                                        <ChecklistDot done={job.checklist.material_requisition.done} label="MR" icon="fi-rr-clipboard-list" />
                                                        <ChecklistDot done={job.checklist.section_assign.done} label="Work Order" icon="fi-rr-sitemap" sub={job.checklist.section_assign.count > 0 ? job.checklist.section_assign.count : undefined} />
                                                        <ChecklistDot done={job.checklist.operation_sheet.done} label="Op Sheet" icon="fi-rr-document" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mobile checklist */}
                                            {!isClosed && (
                                                <div className="lg:hidden flex items-center gap-2 mt-3 pt-3 border-t border-surface-50">
                                                    <ChecklistDot done={job.checklist.material_requisition.done} label="MR" icon="fi-rr-clipboard-list" />
                                                    <ChecklistDot done={job.checklist.section_assign.done} label="WO" icon="fi-rr-sitemap" />
                                                    <ChecklistDot done={job.checklist.operation_sheet.done} label="OS" icon="fi-rr-document" />
                                                </div>
                                            )}
                                        </Link>

                                        {/* Always-visible Close Job button — sized to match the checklist pills */}
                                        {!isClosed && (
                                            <button
                                                type="button"
                                                onClick={(e) => openCancel(job, e)}
                                                className="hidden lg:flex absolute top-4 right-5 flex-col items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 hover:border-red-400 transition-colors"
                                                title={`Close job ${job.job_number ?? job.wo_number}`}
                                            >
                                                <i className="fi fi-rr-cross-circle text-sm leading-none text-red-500" />
                                                <span className="text-[9px] font-semibold text-red-600">Close</span>
                                            </button>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Close-job modal */}
            {cancelJob && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-surface-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                                    <i className="fi fi-rr-cross-circle text-base" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">Close Job</h3>
                                    <p className="text-xs text-surface-500">
                                        Job #{cancelJob.job_number} · {cancelJob.wo_number}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="text-sm text-surface-700">
                                This marks the job as <span className="font-semibold text-red-600">closed</span>. It stays visible in the PCD inbox for records but is hidden from production shops.
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Reason for closing <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={4}
                                    className="form-input"
                                    style={{ resize: 'vertical' }}
                                    placeholder="e.g. R&D trial inconclusive — material behaviour unstable beyond 600°C, client agreed to drop the trial."
                                    autoFocus
                                />
                                <p className="form-hint">Minimum 3 characters. This is logged in the audit trail.</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Attach Office Order / Supporting Documents <span className="form-label-optional">optional</span>
                                </label>
                                <label className="block border-2 border-dashed border-surface-200 rounded-xl px-4 py-5 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors">
                                    <i className="fi fi-rr-cloud-upload text-2xl text-surface-400 leading-none" />
                                    <div className="text-sm font-semibold text-surface-700 mt-2">Click to upload</div>
                                    <div className="text-[11px] text-surface-400 mt-0.5">PDF, JPG, PNG, DOC, XLS · up to 20 MB each (max 10 files)</div>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={onFiles}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                        className="hidden"
                                    />
                                </label>

                                {attachments.length > 0 && (
                                    <ul className="mt-3 space-y-2">
                                        {attachments.map((f, idx) => (
                                            <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <i className="fi fi-rr-document text-surface-400 text-sm shrink-0" />
                                                    <span className="text-xs font-medium text-surface-700 truncate">{f.name}</span>
                                                    <span className="text-[10px] text-surface-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Remove"
                                                >
                                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={submitting}
                                className="btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitCancel}
                                disabled={submitting || reason.trim().length < 3}
                                className="btn bg-red-600 hover:bg-red-700 text-white"
                            >
                                {submitting ? (
                                    <>
                                        <i className="fi fi-rr-spinner animate-spin text-sm" /> Closing...
                                    </>
                                ) : (
                                    <>
                                        <i className="fi fi-rr-cross-circle text-sm" /> Close Job
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

function StatTile({ label, value, icon, color }: any) {
    const colors: Record<string, string> = {
        blue:  'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        green: 'bg-emerald-50 text-emerald-600',
        red:   'bg-red-50 text-red-600',
        rose:  'bg-rose-50 text-rose-600',
    };
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
                <i className={`fi ${icon} text-base leading-none`} />
            </div>
            <div>
                <div className="text-2xl font-bold text-surface-900 leading-none">{value}</div>
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
        </div>
    );
}

function ChecklistDot({ done, label, icon, sub }: { done: boolean; label: string; icon: string; sub?: number }) {
    return (
        <div className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border ${done ? 'border-emerald-200 bg-emerald-50' : 'border-surface-200 bg-surface-50'}`}>
            <div className="relative">
                <i className={`fi ${icon} text-sm leading-none ${done ? 'text-emerald-600' : 'text-surface-400'}`} />
                {done && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                        <i className="fi fi-rr-check text-white text-[6px] leading-none" />
                    </div>
                )}
            </div>
            <span className={`text-[9px] font-semibold ${done ? 'text-emerald-700' : 'text-surface-500'}`}>
                {label}{sub != null && ` ${sub}`}
            </span>
        </div>
    );
}
