import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';

/** Live ticking elapsed time between a startIso and now. Re-renders every second. */
function LiveElapsed({ startIso }: { startIso: string }) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);
    void tick; // suppress unused warning

    const start = new Date(startIso).getTime();
    const now   = Date.now();
    const secs  = Math.max(0, Math.floor((now - start) / 1000));
    const h     = Math.floor(secs / 3600);
    const m     = Math.floor((secs % 3600) / 60);
    const s     = secs % 60;
    const pad   = (n: number) => String(n).padStart(2, '0');
    return <>{h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`}</>;
}

/** Static elapsed (for completed steps). */
function staticElapsed(startIso: string | null, endIso: string | null): string | null {
    if (!startIso || !endIso) return null;
    const secs = Math.max(0, Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface SectionLite { id?: number; name: string; code: string; name_bn?: string | null; }

interface HandoffFile {
    id: number;
    url: string;
    filename: string;
    extension: string | null;
    human_size: string | null;
}

interface Handoff {
    id: number;
    direction: 'forward' | 'backward' | 'rework_return';
    note: string | null;
    from_section: { name: string; code: string } | null;
    to_section: { name: string; code: string };
    transferred_by: string | null;
    transferred_at: string | null;
    files: HandoffFile[];
}

interface Wos {
    id: number;
    sequence: number;
    status: string;
    notes: string | null;
    started_at: string | null;
    completed_at: string | null;
    section: SectionLite;
    work_order: {
        id: number;
        wo_number: string;
        job_number: number | null;
        customer: string;
        product: string | null;
        quantity: number;
        job_type: string;
        due_date: string | null;
    };
}

interface RoutingStep {
    id: number;
    sequence: number;
    status: string;
    section: { name: string; code: string };
}

interface OpStep {
    id: number;
    sequence: number;
    operation_name: string;
    machine: string | null;
    operator: string | null;
    estimated_hours: number;
    actual_hours: number;
    weight_pct: number;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    started_at: string | null;
    started_at_iso: string | null;
    completed_at: string | null;
    completed_at_iso: string | null;
    tooling_notes: string | null;
    qc_notes: string | null;
}

interface EarlierSection {
    wos_id: number;
    sequence: number;
    section: { name: string; code: string };
    status: string;
}

interface Props {
    wos: Wos;
    routing: RoutingStep[];
    op_steps: OpStep[];
    handoffs: Handoff[];
    rework_context: {
        from_section: string;
        transferred_by: string;
        transferred_at: string;
        note: string;
        files: HandoffFile[];
    } | null;
    earlier_sections: EarlierSection[];
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', ready: 'Ready', in_progress: 'In Progress',
    completed: 'Completed', skipped: 'Skipped',
    rework: 'Rework', awaiting_rework: 'Awaiting Rework',
};

const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-slate', ready: 'badge-blue', in_progress: 'badge-amber',
    completed: 'badge-green', skipped: 'badge-slate',
    rework: 'badge-red', awaiting_rework: 'badge-slate',
};

export default function ProductionShow({ wos, routing, op_steps, handoffs, rework_context, earlier_sections }: Props) {
    const [showComplete, setShowComplete] = useState(false);
    const [showSendBack, setShowSendBack] = useState(false);

    const canAct = ['ready', 'in_progress', 'rework'].includes(wos.status);
    const canSendBack = ['ready', 'in_progress'].includes(wos.status) && earlier_sections.length > 0;
    const isReworkMode = wos.status === 'rework';

    // Section can only be forwarded when every operation step here is closed.
    const openSteps = op_steps.filter((s) => s.status !== 'completed' && s.status !== 'skipped');
    const allStepsDone = op_steps.length === 0 || openSteps.length === 0;
    const completedSteps = op_steps.filter((s) => s.status === 'completed').length;
    const stepProgressPct = op_steps.length === 0 ? 0 : Math.round((completedSteps / op_steps.length) * 100);

    return (
        <AppLayout header={`${wos.section.name} — Job #${wos.work_order.job_number}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md ${
                                    isReworkMode ? 'bg-rose-500' : 'bg-gradient-to-br from-brand-500 to-brand-700'
                                }`}>
                                    {wos.work_order.job_number ?? '#'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-surface-900">Job #{wos.work_order.job_number}</h2>
                                        <JobTypeBadge type={wos.work_order.job_type} />
                                        <span className={`badge ${STATUS_BADGE[wos.status] ?? 'badge-slate'}`}>
                                            {STATUS_LABEL[wos.status] ?? wos.status}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600">
                                        <span><i className="fi fi-rr-document text-surface-400" /> {wos.work_order.wo_number}</span>
                                        <span><i className="fi fi-rr-building text-surface-400" /> {wos.work_order.customer}</span>
                                        <span><i className="fi fi-rr-cube text-surface-400" /> qty {wos.work_order.quantity}</span>
                                        {wos.work_order.due_date && <span><i className="fi fi-rr-calendar text-surface-400" /> Due {wos.work_order.due_date}</span>}
                                    </div>
                                    {wos.work_order.product && (
                                        <p className="text-sm text-surface-700 mt-1">{wos.work_order.product}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <Link href="/production/queue" className="btn-outline btn-sm">
                                    <i className="fi fi-rr-arrow-left text-xs" /> Queue
                                </Link>
                                {canSendBack && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSendBack(true)}
                                        className="btn-outline btn-sm border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400"
                                    >
                                        <i className="fi fi-rr-undo-alt text-xs" /> Send Back
                                    </button>
                                )}
                                {canAct && (
                                    <button
                                        type="button"
                                        onClick={() => setShowComplete(true)}
                                        disabled={!allStepsDone}
                                        title={allStepsDone ? '' : `${openSteps.length} operation step(s) still open. Close each step first.`}
                                        className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <i className="fi fi-rr-check text-xs" />
                                        {isReworkMode ? 'Complete Rework & Return' : 'Complete & Forward'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Rework banner */}
                {rework_context && (
                    <div className="card border-rose-300 overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="fi fi-rr-undo-alt text-base leading-none" />
                                <span className="text-sm font-bold uppercase tracking-wider">Rework Requested</span>
                            </div>
                            <span className="text-[11px] text-white/80">{rework_context.transferred_at}</span>
                        </div>
                        <div className="card-body space-y-3">
                            <div className="text-sm">
                                <span className="text-surface-500">Flagged by:</span>{' '}
                                <span className="font-semibold text-surface-900">{rework_context.from_section}</span>
                                {' · '}
                                <span className="text-surface-700">{rework_context.transferred_by}</span>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Defect / Issue</div>
                                <div className="text-sm text-surface-800 whitespace-pre-line bg-rose-50/60 border border-rose-100 rounded-xl px-3 py-2.5">
                                    {rework_context.note}
                                </div>
                            </div>
                            {rework_context.files.length > 0 && (
                                <FileGrid files={rework_context.files} title="Defect Photos / Documents" />
                            )}
                        </div>
                    </div>
                )}

                {/* Routing strip */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Routing</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Full section sequence for this work order</p>
                    </div>
                    <div className="card-body">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {routing.map((r, idx) => (
                                <div key={r.id} className="flex items-center gap-2 shrink-0">
                                    <div className={`px-3 py-2 rounded-xl border ${
                                        r.id === wos.id
                                            ? 'border-brand-400 bg-brand-50'
                                            : 'border-surface-100 bg-white'
                                    }`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-surface-400">{r.sequence}.</span>
                                            <span className={`text-xs font-semibold ${r.id === wos.id ? 'text-brand-700' : 'text-surface-800'}`}>{r.section.name}</span>
                                        </div>
                                        <div className="text-[10px] mt-0.5">
                                            <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-slate'} text-[9px]`}>
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </span>
                                        </div>
                                    </div>
                                    {idx < routing.length - 1 && (
                                        <i className="fi fi-rr-arrow-right text-surface-300 text-xs" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* This section's operation steps — operators close each one individually */}
                {op_steps.length > 0 && (
                    <div className="card">
                        <div className="card-header flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Operations for this section</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Close each operation as you finish it. Section forwards once all are done.</p>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-xs font-semibold text-surface-700">{completedSteps} of {op_steps.length} done</div>
                                <div className="w-32 h-1.5 bg-surface-100 rounded-full mt-1 overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${stepProgressPct === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                        style={{ width: `${stepProgressPct}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-surface-400 mt-0.5">{stepProgressPct}%</div>
                            </div>
                        </div>
                        <div className="card-body p-0 divide-y divide-surface-100">
                            {op_steps.map((s) => (
                                <OpStepRow key={s.id} step={s} canAct={canAct} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Handoff history */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Handoff History</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Every transition this job has been through</p>
                    </div>
                    <div className="card-body">
                        {handoffs.length === 0 ? (
                            <div className="text-sm text-surface-400 italic">No handoffs yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {handoffs.map((h) => <HandoffRow key={h.id} h={h} />)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showComplete && (
                <CompleteModal
                    wosId={wos.id}
                    isRework={isReworkMode}
                    onClose={() => setShowComplete(false)}
                />
            )}
            {showSendBack && (
                <SendBackModal
                    wosId={wos.id}
                    earlierSections={earlier_sections}
                    onClose={() => setShowSendBack(false)}
                />
            )}
        </AppLayout>
    );
}

function OpStepRow({ step, canAct }: { step: OpStep; canAct: boolean }) {
    const [busy, setBusy] = useState(false);

    const fire = (action: 'start' | 'complete' | 'reopen') => {
        setBusy(true);
        router.post(`/production/op-steps/${step.id}/mark`, { action }, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
        });
    };

    const statusBadge: Record<string, { cls: string; label: string; icon: string }> = {
        pending:     { cls: 'badge-slate', label: 'Pending',     icon: 'fi-rr-time-twenty-four' },
        in_progress: { cls: 'badge-amber', label: 'In Progress', icon: 'fi-rr-spinner' },
        completed:   { cls: 'badge-green', label: 'Completed',   icon: 'fi-rr-check-circle' },
        skipped:     { cls: 'badge-slate', label: 'Skipped',     icon: 'fi-rr-forward' },
    };
    const sb = statusBadge[step.status] ?? statusBadge.pending;

    return (
        <div className={`px-5 py-3.5 ${step.status === 'completed' ? 'bg-emerald-50/40' : ''}`}>
            <div className="flex items-start gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center ${
                    step.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    step.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-surface-100 text-surface-500'
                }`}>
                    {step.sequence}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-surface-900">{step.operation_name}</span>
                        <span className={`badge ${sb.cls} text-[10px]`}>
                            <i className={`fi ${sb.icon} text-[9px]`} /> {sb.label}
                        </span>
                        {step.weight_pct > 0 && (
                            <span className="text-[10px] text-surface-400">{step.weight_pct.toFixed(1)}% of progress</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 flex-wrap">
                        {step.machine && <span><i className="fi fi-rr-settings text-[10px]" /> {step.machine}</span>}
                        {step.operator && <span><i className="fi fi-rr-user text-[10px]" /> {step.operator}</span>}
                        <span><i className="fi fi-rr-clock text-[10px]" /> est {step.estimated_hours.toFixed(1)}h</span>
                        {step.actual_hours > 0 && <span className="text-emerald-600">· actual {step.actual_hours.toFixed(2)}h</span>}
                    </div>

                    {/* Live running timer (in_progress) */}
                    {step.status === 'in_progress' && step.started_at_iso && (
                        <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                            <span className="text-xs font-bold text-amber-800 font-mono">
                                <LiveElapsed startIso={step.started_at_iso} />
                            </span>
                            <span className="text-[10px] text-amber-700">running</span>
                            {step.started_at && (
                                <span className="text-[10px] text-amber-600 ml-1">· since {step.started_at}</span>
                            )}
                        </div>
                    )}

                    {step.tooling_notes && (
                        <div className="text-xs text-surface-500 mt-1 italic">Tools: {step.tooling_notes}</div>
                    )}
                    {step.qc_notes && (
                        <div className="text-xs text-rose-700 mt-1 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1">
                            <i className="fi fi-rr-shield-check text-[10px]" /> QC: {step.qc_notes}
                        </div>
                    )}
                    {step.completed_at && step.status === 'completed' && (
                        <div className="text-[10px] text-emerald-700 mt-1">
                            Completed {step.completed_at}
                            {(() => {
                                const el = staticElapsed(step.started_at_iso, step.completed_at_iso);
                                return el ? <span className="ml-2 text-emerald-600">· took {el}</span> : null;
                            })()}
                        </div>
                    )}
                </div>

                {canAct && (
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {step.status === 'pending' && (
                            <button type="button" onClick={() => fire('start')} disabled={busy}
                                className="btn-outline btn-sm">
                                <i className="fi fi-rr-play text-xs" /> Start
                            </button>
                        )}
                        {(step.status === 'pending' || step.status === 'in_progress') && (
                            <button type="button" onClick={() => fire('complete')} disabled={busy}
                                className="btn-primary btn-sm">
                                <i className="fi fi-rr-check text-xs" /> Complete
                            </button>
                        )}
                        {step.status === 'completed' && (
                            <button type="button" onClick={() => fire('reopen')} disabled={busy}
                                className="btn-ghost btn-sm text-rose-600">
                                <i className="fi fi-rr-rotate-left text-xs" /> Reopen
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function HandoffRow({ h }: { h: Handoff }) {
    const dirCfg = {
        forward:        { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', icon: 'fi-rr-arrow-right',  label: 'Forwarded'  },
        backward:       { bg: 'bg-rose-50 border-rose-100',       text: 'text-rose-700',    icon: 'fi-rr-undo-alt',     label: 'Sent Back'  },
        rework_return:  { bg: 'bg-indigo-50 border-indigo-100',   text: 'text-indigo-700',  icon: 'fi-rr-refresh',      label: 'Rework Returned' },
    }[h.direction];

    return (
        <div className={`rounded-xl border ${dirCfg.bg} p-3`}>
            <div className="flex items-center gap-2 flex-wrap">
                <i className={`fi ${dirCfg.icon} text-xs ${dirCfg.text}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${dirCfg.text}`}>{dirCfg.label}</span>
                {h.from_section && (
                    <span className="text-xs text-surface-700">
                        {h.from_section.name}
                        <i className="fi fi-rr-arrow-right text-[10px] text-surface-400 mx-1.5" />
                    </span>
                )}
                <span className="text-xs font-semibold text-surface-900">{h.to_section.name}</span>
                <span className="ml-auto text-[11px] text-surface-500">{h.transferred_at}</span>
            </div>
            <div className="text-[11px] text-surface-500 mt-1">
                by {h.transferred_by ?? '—'}
            </div>
            {h.note && (
                <div className="text-sm text-surface-800 mt-2 whitespace-pre-line bg-white/70 rounded-lg px-2.5 py-1.5 border border-white">
                    {h.note}
                </div>
            )}
            {h.files.length > 0 && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {h.files.map((f) => <FileLink key={f.id} file={f} />)}
                </div>
            )}
        </div>
    );
}

function FileLink({ file }: { file: HandoffFile }) {
    return (
        <a href={file.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-surface-100 hover:border-brand-300">
            <div className="w-8 h-8 rounded-lg bg-surface-50 text-surface-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                {(file.extension ?? 'FILE').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-surface-800 truncate">{file.filename}</div>
                <div className="text-[10px] text-surface-400">{file.human_size}</div>
            </div>
            <i className="fi fi-rr-download text-surface-400 text-xs" />
        </a>
    );
}

function FileGrid({ files, title }: { files: HandoffFile[]; title: string }) {
    return (
        <div>
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">{title}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f) => <FileLink key={f.id} file={f} />)}
            </div>
        </div>
    );
}

function CompleteModal({ wosId, isRework, onClose }: { wosId: number; isRework: boolean; onClose: () => void }) {
    const [note, setNote] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        setSubmitting(true);
        const form = new FormData();
        if (note) form.append('note', note);
        files.forEach((f) => form.append('attachments[]', f));
        router.post(`/production/wos/${wosId}/complete`, form, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setSubmitting(false),
            onSuccess: onClose,
        });
    };

    return (
        <ModalShell title={isRework ? 'Complete Rework' : 'Complete & Forward'} onClose={onClose} disabled={submitting}>
            <div className="p-5 space-y-4 overflow-y-auto">
                <div className="text-sm text-surface-700">
                    {isRework
                        ? 'Marks this rework as complete. The job will return to the section that flagged it for re-verification.'
                        : 'Marks this section as completed and forwards the job to the next section in the routing.'}
                </div>
                <div className="form-group">
                    <label className="form-label">Handoff Note <span className="form-label-optional">optional</span></label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="form-input"
                        style={{ resize: 'vertical' }}
                        placeholder="What the next section should know — measurements, tools used, anything unusual…"
                    />
                </div>
                <FilesInput files={files} setFiles={setFiles} />
            </div>
            <ModalFooter onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={isRework ? 'Complete Rework' : 'Complete & Forward'} />
        </ModalShell>
    );
}

function SendBackModal({ wosId, earlierSections, onClose }: { wosId: number; earlierSections: EarlierSection[]; onClose: () => void }) {
    const [targetId, setTargetId] = useState<number | ''>('');
    const [reason, setReason] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        if (!targetId || reason.trim().length < 5) return;
        setSubmitting(true);
        const form = new FormData();
        form.append('target_wos_id', String(targetId));
        form.append('reason', reason);
        files.forEach((f) => form.append('attachments[]', f));
        router.post(`/production/wos/${wosId}/send-back`, form, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setSubmitting(false),
            onSuccess: onClose,
        });
    };

    return (
        <ModalShell title="Send Back for Rework" onClose={onClose} disabled={submitting} accent="rose">
            <div className="p-5 space-y-4 overflow-y-auto">
                <div className="text-sm text-surface-700">
                    Pick an earlier section in the routing to rework the defect. They'll see the reason and any files you attach.
                </div>
                <div className="form-group">
                    <label className="form-label">Send back to <span className="text-red-500">*</span></label>
                    <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}
                        className="form-select"
                    >
                        <option value="">Pick a section…</option>
                        {earlierSections.map((s) => (
                            <option key={s.wos_id} value={s.wos_id}>
                                {s.sequence}. {s.section.name} ({s.section.code})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Reason / Defect Description <span className="text-red-500">*</span></label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        className="form-input"
                        style={{ resize: 'vertical' }}
                        placeholder="What's wrong, where on the part, what needs to be reworked. e.g. 'Dimension 25.05 mm out of tolerance, spec is 25.00 ±0.02. Re-grind to spec.'"
                    />
                    <p className="form-hint">Minimum 5 characters.</p>
                </div>
                <FilesInput files={files} setFiles={setFiles} label="Defect photos / inspection reports" />
            </div>
            <ModalFooter onClose={onClose} onSubmit={submit} submitting={submitting}
                submitDisabled={!targetId || reason.trim().length < 5}
                submitLabel="Send Back" submitAccent="red" />
        </ModalShell>
    );
}

function FilesInput({ files, setFiles, label = 'Attachments' }: { files: File[]; setFiles: (f: File[]) => void; label?: string }) {
    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fs = e.target.files ? Array.from(e.target.files) : [];
        setFiles([...files, ...fs]);
        e.target.value = '';
    };
    const remove = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

    return (
        <div className="form-group">
            <label className="form-label">{label} <span className="form-label-optional">optional</span></label>
            <label className="block border-2 border-dashed border-surface-200 rounded-xl px-4 py-5 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors">
                <i className="fi fi-rr-cloud-upload text-2xl text-surface-400 leading-none" />
                <div className="text-sm font-semibold text-surface-700 mt-2">Click to upload</div>
                <div className="text-[11px] text-surface-400 mt-0.5">PDF, JPG, PNG, DOC, XLS · up to 20 MB each</div>
                <input type="file" multiple onChange={onPick}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" />
            </label>
            {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {files.map((f, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <i className="fi fi-rr-document text-surface-400 text-sm shrink-0" />
                                <span className="text-xs font-medium text-surface-700 truncate">{f.name}</span>
                                <span className="text-[10px] text-surface-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                            </div>
                            <button type="button" onClick={() => remove(idx)} className="text-red-500 hover:text-red-700 p-1">
                                <i className="fi fi-rr-cross-small text-sm leading-none" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ModalShell({ title, children, onClose, disabled, accent }: {
    title: string; children: React.ReactNode; onClose: () => void; disabled: boolean; accent?: 'rose';
}) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
             onClick={() => !disabled && onClose()}>
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col"
                 onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-surface-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            accent === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'
                        }`}>
                            <i className={`fi ${accent === 'rose' ? 'fi-rr-undo-alt' : 'fi-rr-check'} text-base`} />
                        </div>
                        <h3 className="text-base font-bold text-surface-900">{title}</h3>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

function ModalFooter({ onClose, onSubmit, submitting, submitLabel, submitDisabled, submitAccent }: {
    onClose: () => void; onSubmit: () => void; submitting: boolean;
    submitLabel: string; submitDisabled?: boolean; submitAccent?: 'red';
}) {
    const cls = submitAccent === 'red'
        ? 'btn bg-red-600 hover:bg-red-700 text-white'
        : 'btn-primary';
    return (
        <div className="p-4 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2 rounded-b-2xl">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-outline">Cancel</button>
            <button type="button" onClick={onSubmit} disabled={submitting || submitDisabled} className={cls}>
                {submitting ? (<><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving...</>) : submitLabel}
            </button>
        </div>
    );
}
