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

const statusLabel = (status: string): string =>
    status === 'released_to_shops' ? 'Released from PCD to shop' : (status ?? '').replace(/_/g, ' ');

export default function PcdInbox({ jobs, stats }: any) {
    const [cancelJob, setCancelJob] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'all' | 'released' | 'mr_pending'>('all');

    const q = search.trim().toLowerCase();
    const filteredJobs = (jobs as any[]).filter((job) => {
        if (tab === 'released' && job.status !== 'released_to_shops') return false;
        if (tab === 'mr_pending' && (job.status === 'cancelled' || job.checklist?.material_requisition?.done)) return false;
        if (!q) return true;
        return [job.job_number, job.customer_po_no, job.wo_number, job.customer]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
    });
    const awaiting = (jobs as any[]).filter((j) => j.status !== 'cancelled').length;

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

                {/* Page header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-amber-600">Production Control · PCD</div>
                        <h1 className="text-2xl font-extrabold text-surface-900 mt-0.5">Job Queue</h1>
                        <p className="text-sm text-surface-500">Jobs handed off from IED awaiting PCD processing</p>
                    </div>
                    <div className="relative w-full lg:w-72">
                        <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search job #, PO, customer…"
                            className="form-input pl-9 w-full"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatTile label="Total Jobs" value={stats.total} icon="fi-rr-clipboard-list" color="blue" tag="in scope" />
                    <StatTile label="Pending PCD" value={stats.pending} icon="fi-rr-time-check" color="amber" tag="clear" />
                    <StatTile label="Released to Shops" value={stats.released} icon="fi-rr-check-circle" color="green" tag="live" />
                    <StatTile label="MR Pending" value={stats.mr_pending} icon="fi-rr-document" color="red" tag="action" />
                    <StatTile label="Closed" value={stats.cancelled ?? 0} icon="fi-rr-cross-circle" color="rose" tag="period" />
                </div>

                {/* Job Queue */}
                <div className="card">
                    <div className="card-header flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-surface-900">PCD Job Queue</h2>
                            {awaiting > 0 && <span className="badge badge-amber">{awaiting} awaiting</span>}
                        </div>
                        <div className="flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5">
                            {([['all', 'All'], ['released', 'Released'], ['mr_pending', 'MR Pending']] as const).map(([key, lbl]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTab(key)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {filteredJobs.length > 0 && (
                            <div className="hidden lg:flex items-center px-5 py-2 text-[10px] uppercase tracking-wider font-bold text-surface-400 border-b border-surface-100 bg-surface-50/40">
                                <span className="flex-1">Job</span>
                                <span className="w-[300px] text-center">PCD Workflow</span>
                                <span className="w-44 text-right">Actions</span>
                            </div>
                        )}

                        {filteredJobs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-inbox" /></div>
                                <div className="empty-state-title">{jobs.length === 0 ? 'No jobs in PCD inbox' : 'No matching jobs'}</div>
                                <div className="empty-state-text">{jobs.length === 0 ? 'Jobs will appear here once IED issues a Work Order from an accepted quotation.' : 'Try a different search or filter.'}</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {filteredJobs.map((job: any) => {
                                    const isClosed = job.status === 'cancelled';
                                    const c = job.checklist ?? {};
                                    return (
                                        <div key={job.id} className={`flex flex-col lg:flex-row lg:items-center gap-4 px-5 py-4 transition-colors ${isClosed ? 'bg-rose-50/40' : 'hover:bg-brand-50/20'}`}>
                                            {/* Job info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-bold text-sm ${isClosed ? 'line-through text-surface-500' : 'text-surface-900'}`}>#{job.job_number ?? job.customer_po_no ?? job.wo_number}</span>
                                                    <JobTypeBadge type={job.job_type} size="xs" />
                                                    <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-slate'} capitalize`}>{statusLabel(job.status)}</span>
                                                    {!isClosed && <span className={`badge ${PRIORITY_BADGE[job.priority] ?? 'badge-slate'} capitalize`}>{job.priority}</span>}
                                                </div>
                                                <div className={`text-sm font-semibold mt-1 ${isClosed ? 'text-surface-500' : 'text-surface-900'}`}>{job.customer}</div>
                                                {isClosed ? (
                                                    <div className="text-xs text-rose-700 mt-1">
                                                        Closed{job.cancelled_at ? ` · ${job.cancelled_at}` : ''}{job.cancelled_by ? ` · by ${job.cancelled_by}` : ''}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-surface-500 mt-1">
                                                        {job.item_count} items · qty {job.quantity}{job.due_date ? ` · due ${job.due_date}` : ''} · handed off {job.pcd_handoff_at}
                                                    </div>
                                                )}
                                            </div>

                                            {/* PCD workflow mini-steps */}
                                            {!isClosed ? (
                                                <div className="hidden lg:flex items-center justify-center gap-1 w-[300px] shrink-0">
                                                    <MiniStep done={c.material_requisition?.done} icon="fi-rr-clipboard-list" label="MR" sub={c.material_requisition?.done ? 'done' : 'optional'} muted />
                                                    <span className="w-4 h-px bg-surface-200" />
                                                    <MiniStep done={c.section_assign?.done} icon="fi-rr-sitemap" label="Work Order" sub={c.section_assign?.done ? `${c.section_assign?.count ?? 0} shops` : '—'} />
                                                    <span className="w-4 h-px bg-surface-200" />
                                                    <MiniStep done={c.operation_sheet?.done} icon="fi-rr-document" label="Op Sheet" sub={c.operation_sheet?.done ? 'done' : '—'} />
                                                </div>
                                            ) : (
                                                <div className="hidden lg:block w-[300px] shrink-0" />
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-2 w-full lg:w-44 shrink-0">
                                                {!isClosed && (
                                                    <button type="button" onClick={(e) => openCancel(job, e)} className="btn-outline btn-sm">
                                                        Close
                                                    </button>
                                                )}
                                                <Link href={`/pcd/inbox/${job.id}`} className="btn-primary btn-sm">
                                                    Open <i className="fi fi-rr-arrow-right text-xs leading-none ml-1" />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 text-xs text-surface-400">
                        <span>Showing {filteredJobs.length} of {jobs.length} job{jobs.length === 1 ? '' : 's'} in queue</span>
                        <span>Auto-refreshed · just now</span>
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

function StatTile({ label, value, icon, color, tag }: any) {
    const colors: Record<string, { box: string; tag: string }> = {
        blue:  { box: 'bg-blue-50 text-blue-600',       tag: 'bg-blue-50 text-blue-600' },
        amber: { box: 'bg-amber-50 text-amber-600',     tag: 'bg-amber-50 text-amber-600' },
        green: { box: 'bg-emerald-50 text-emerald-600', tag: 'bg-emerald-50 text-emerald-600' },
        red:   { box: 'bg-red-50 text-red-600',         tag: 'bg-red-50 text-red-600' },
        rose:  { box: 'bg-rose-50 text-rose-600',       tag: 'bg-rose-50 text-rose-600' },
    };
    const c = colors[color] ?? colors.blue;
    return (
        <div className="card p-4">
            <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.box}`}>
                    <i className={`fi ${icon} text-base leading-none`} />
                </div>
                {tag && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.tag}`}>{tag}</span>
                )}
            </div>
            <div className="mt-3">
                <div className="text-2xl font-extrabold text-surface-900 leading-none">
                    {value} <span className="text-xs font-semibold text-surface-400">{value === 1 ? 'job' : 'jobs'}</span>
                </div>
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
        </div>
    );
}

function MiniStep({ done, icon, label, sub, muted }: { done?: boolean; icon: string; label: string; sub: string; muted?: boolean }) {
    return (
        <div className="flex flex-col items-center text-center w-[88px]">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${done ? 'bg-emerald-100 text-emerald-600' : muted ? 'bg-surface-100 text-surface-400' : 'bg-surface-100 text-surface-500'}`}>
                <i className={`fi ${done ? 'fi-rr-check' : icon} text-sm leading-none`} />
            </div>
            <div className="text-[10px] font-semibold text-surface-700 mt-1 leading-tight">{label}</div>
            <div className="text-[9px] text-surface-400 leading-tight">{sub}</div>
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
