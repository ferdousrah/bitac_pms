import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';

interface Log {
    id: number;
    log_date: string | null;
    qty: number;
    machine: string | null;
    operator: string | null;
    remarks: string | null;
}

interface Step {
    id: number;
    item_label: string;
    operation_name: string;
    sub_section: string | null;
    machine: string | null;
    operator: string | null;
    target_qty: number;
    completed_qty: number;
    remaining_qty: number;
    status: string;
    logs: Log[];
}

interface Handoff {
    qty: number | null;
    to: string | null;
    when: string | null;
}

interface CycleSection {
    id: number;
    sequence: number;
    section: { name: string | null; code: string | null };
    weight_pct: number;
    status: string;
    progress: number;
    received_qty: number | null;
    output_qty: number;
    forwarded_qty: number;
    target_qty: number;
    started_at: string | null;
    completed_at: string | null;
    steps: Step[];
    handoffs: Handoff[];
}

interface Props {
    work_order: {
        id: number;
        wo_number: string;
        job_number: number | null;
        customer: string | null;
        product: string | null;
        quantity: number;
        job_type: string;
        status: string;
        status_label: string;
        due_date: string | null;
        progress: number | null;
    };
    sections: CycleSection[];
    machine_usage: { machine: string; qty: number; hours: number; entries: number }[];
}

const nf = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-slate', ready: 'badge-blue', in_progress: 'badge-amber',
    completed: 'badge-green', skipped: 'badge-slate',
    rework: 'badge-red', awaiting_rework: 'badge-slate',
};
const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', ready: 'Ready', in_progress: 'In Progress',
    completed: 'Completed', skipped: 'Skipped',
    rework: 'Rework', awaiting_rework: 'Awaiting Rework',
};

export default function ProductionCycle({ work_order, sections, machine_usage }: Props) {
    return (
        <AppLayout header={`Production Cycle — Job# ${work_order.job_number ?? work_order.wo_number}`}>
            <div className="space-y-6 animate-fade-in max-w-5xl">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md">
                                    {work_order.job_number ?? '#'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-surface-900">Job# {work_order.job_number ?? '—'}</h2>
                                        <JobTypeBadge type={work_order.job_type} />
                                        <span className="badge badge-slate">{work_order.status_label}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600">
                                        {work_order.customer && <span><i className="fi fi-rr-building text-surface-400" /> {work_order.customer}</span>}
                                        <span><i className="fi fi-rr-cube text-surface-400" /> qty {nf(work_order.quantity)}</span>
                                        {work_order.due_date && <span><i className="fi fi-rr-calendar text-surface-400" /> Due {work_order.due_date}</span>}
                                    </div>
                                    {work_order.product && <p className="text-sm text-surface-700 mt-1">{work_order.product}</p>}
                                </div>
                            </div>
                            <Link href={`/work-orders/${work_order.id}`} className="btn-outline btn-sm shrink-0">
                                <i className="fi fi-rr-file text-xs" /> Work Order
                            </Link>
                        </div>

                        {/* Overall progress */}
                        {work_order.progress != null && (
                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-semibold text-surface-600">Overall production progress</span>
                                    <span className="font-bold text-surface-900">{work_order.progress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${work_order.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                         style={{ width: `${work_order.progress}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Routing timeline */}
                <div className="space-y-4">
                    {sections.map((s, i) => (
                        <SectionCard key={s.id} s={s} isLast={i === sections.length - 1} />
                    ))}
                </div>

                {/* Machine usage */}
                {machine_usage.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Machine Usage</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Output logged per machine across the whole job</p>
                        </div>
                        <div className="card-body p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50 text-left text-xs text-surface-500">
                                    <tr>
                                        <th className="px-5 py-2 font-semibold">Machine</th>
                                        <th className="px-3 py-2 font-semibold text-right">Qty produced</th>
                                        <th className="px-3 py-2 font-semibold text-right">Hours</th>
                                        <th className="px-5 py-2 font-semibold text-right">Log entries</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {machine_usage.map((m, idx) => (
                                        <tr key={idx}>
                                            <td className="px-5 py-2.5 font-medium text-surface-800">
                                                <i className="fi fi-rr-settings text-surface-400 text-[11px]" /> {m.machine}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-surface-900">{nf(m.qty)}</td>
                                            <td className="px-3 py-2.5 text-right text-surface-600">{m.hours > 0 ? `${nf(m.hours)}h` : '—'}</td>
                                            <td className="px-5 py-2.5 text-right text-surface-500">{m.entries}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function SectionCard({ s, isLast }: { s: CycleSection; isLast: boolean }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="relative">
            {/* Connector line */}
            {!isLast && <div className="absolute left-[27px] top-14 bottom-[-1rem] w-0.5 bg-surface-200" />}
            <div className="card">
                <div className="card-body">
                    <div className="flex items-start gap-4">
                        {/* Sequence node */}
                        <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm z-10 ${
                            s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            ['in_progress', 'rework'].includes(s.status) ? 'bg-amber-100 text-amber-700' :
                            'bg-surface-100 text-surface-500'
                        }`}>
                            {s.sequence}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-surface-900">{s.section.name}</h3>
                                <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-slate'}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                                {s.weight_pct > 0 && (
                                    <span className="badge badge-violet text-[10px]"><i className="fi fi-rr-chart-pie-alt text-[9px]" /> {s.weight_pct.toFixed(2)}% of job</span>
                                )}
                                <span className="text-[11px] text-surface-400">{s.progress}% done</span>
                            </div>

                            {/* Qty ledger */}
                            {s.target_qty > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    {s.received_qty !== null && (
                                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                                            <i className="fi fi-rr-inbox-in text-[9px]" /> Received {nf(s.received_qty)} / {nf(s.target_qty)}
                                        </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        <i className="fi fi-rr-box-check text-[9px]" /> Completed {nf(s.output_qty)}
                                    </span>
                                    {s.forwarded_qty > 0 && (
                                        <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                                            <i className="fi fi-rr-paper-plane text-[9px]" /> Forwarded {nf(s.forwarded_qty)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Progress bar */}
                            <div className="mt-2 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                                <div className={`h-full rounded-full ${s.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${s.progress}%` }} />
                            </div>

                            <div className="mt-2 flex items-center gap-3 text-[11px] text-surface-400 flex-wrap">
                                {s.started_at && <span>Started {s.started_at}</span>}
                                {s.completed_at && <span className="text-emerald-600">Completed {s.completed_at}</span>}
                                {s.steps.length > 0 && (
                                    <button type="button" onClick={() => setOpen(o => !o)} className="text-brand-600 hover:underline ml-auto">
                                        {open ? 'Hide' : 'Show'} operations ({s.steps.length})
                                    </button>
                                )}
                            </div>

                            {/* Operations */}
                            {open && s.steps.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {s.steps.map((st) => (
                                        <div key={st.id} className="rounded-xl border border-surface-100 bg-surface-50/50 px-3 py-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-surface-900">{st.operation_name}</span>
                                                <span className="badge badge-slate text-[10px]">{st.item_label}</span>
                                                <span className={`badge ${STATUS_BADGE[st.status] ?? 'badge-slate'} text-[10px]`}>{STATUS_LABEL[st.status] ?? st.status}</span>
                                                {st.sub_section && <span className="text-[11px] text-violet-600"><i className="fi fi-rr-corner-down-right text-[9px]" /> {st.sub_section}</span>}
                                            </div>
                                            <div className="mt-1 flex items-center gap-3 text-[11px] text-surface-500 flex-wrap">
                                                <span className="font-mono text-surface-700">{nf(st.completed_qty)} / {nf(st.target_qty)}</span>
                                                {st.remaining_qty > 0 && <span className="text-amber-600">{nf(st.remaining_qty)} left</span>}
                                                {st.machine && <span><i className="fi fi-rr-settings text-[9px]" /> {st.machine}</span>}
                                                {st.operator && <span><i className="fi fi-rr-user text-[9px]" /> {st.operator}</span>}
                                            </div>
                                            {st.logs.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {st.logs.map((l) => (
                                                        <div key={l.id} className="flex items-center gap-2 text-[11px] text-surface-500">
                                                            <span className="font-mono font-semibold text-surface-700">{nf(l.qty)}</span>
                                                            <span className="text-surface-400">pcs ·</span>
                                                            <span>{l.log_date}</span>
                                                            {l.machine && <span className="text-surface-400">· {l.machine}</span>}
                                                            {l.operator && <span className="text-surface-400">· {l.operator}</span>}
                                                            {l.remarks && <span className="text-surface-400 truncate">· {l.remarks}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Handoffs out */}
                            {s.handoffs.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {s.handoffs.map((h, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            <i className="fi fi-rr-paper-plane text-[9px]" />
                                            {h.qty !== null ? `${nf(h.qty)} pcs` : ''} → {h.to ?? 'QC'} <span className="text-emerald-500">· {h.when}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
