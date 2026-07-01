import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface SectionRow {
    id: number;
    section: { name: string | null; code: string | null };
    sequence: number;
    status: string;
    weight_pct: number;
    reorderable: boolean;
    bottleneck: { reason: string; by: string | null; at: string } | null;
}

interface Props {
    work_order: { id: number; wo_number: string; job_number: number | null; customer: string | null };
    sections: SectionRow[];
}

const STATUS_BADGE: Record<string, string> = {
    pending: 'badge-slate', ready: 'badge-blue', in_progress: 'badge-amber',
    completed: 'badge-green', skipped: 'badge-slate',
    rework: 'badge-red', awaiting_rework: 'badge-slate',
};

export default function Reroute({ work_order, sections }: Props) {
    const locked = sections.filter((s) => !s.reorderable);
    const [order, setOrder] = useState<SectionRow[]>(sections.filter((s) => s.reorderable));
    const [saving, setSaving] = useState(false);

    const move = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= order.length) return;
        const next = [...order];
        [next[idx], next[j]] = [next[j], next[idx]];
        setOrder(next);
    };

    const save = () => {
        setSaving(true);
        router.put(`/pcd/work-orders/${work_order.id}/reroute`,
            { order: order.map((s) => s.id) },
            { onFinish: () => setSaving(false) });
    };

    return (
        <AppLayout header={`Reroute — Job# ${work_order.job_number ?? work_order.wo_number}`}>
            <div className="space-y-6 animate-fade-in max-w-3xl">
                <div className="card">
                    <div className="card-body">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-lg font-bold text-surface-900">Reroute Job# {work_order.job_number ?? '—'}</h1>
                                <p className="text-sm text-surface-500 mt-0.5">{work_order.customer}</p>
                            </div>
                            <Link href={`/work-orders/${work_order.id}`} className="btn-ghost btn-sm">
                                <i className="fi fi-rr-cross-small text-sm" /> Cancel
                            </Link>
                        </div>
                        <div className="mt-3 rounded-xl bg-sky-50 border border-sky-100 px-3 py-2.5 text-sm text-sky-800">
                            <i className="fi fi-rr-info text-xs" /> Reorder the <b>remaining</b> sections so a free section does its
                            work first when another is a bottleneck. Only do this when the operations don't depend on each other —
                            sections already completed or in progress are locked.
                        </div>
                    </div>
                </div>

                {/* Locked sections */}
                {locked.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h2 className="text-sm font-bold text-surface-900">Locked</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Already done, in progress, or holding quantity — can't move</p>
                        </div>
                        <div className="card-body p-0 divide-y divide-surface-100">
                            {locked.map((s) => (
                                <div key={s.id} className="px-5 py-3 flex items-center gap-3 opacity-70">
                                    <i className="fi fi-rr-lock text-surface-400 text-sm" />
                                    <span className="font-mono text-xs text-surface-500 w-6">{s.sequence}</span>
                                    <span className="font-semibold text-surface-800">{s.section.name}</span>
                                    <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-slate'} text-[10px]`}>{s.status.replace(/_/g, ' ')}</span>
                                    {s.weight_pct > 0 && <span className="text-[11px] text-surface-400">{s.weight_pct.toFixed(2)}%</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reorderable sections */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-sm font-bold text-surface-900">Reorder remaining sections</h2>
                        <p className="text-xs text-surface-400 mt-0.5">Use the arrows to change the order. The first one becomes the active section.</p>
                    </div>
                    <div className="card-body p-0">
                        {order.length === 0 ? (
                            <div className="empty-state py-8">
                                <div className="empty-state-text">No reorderable sections — everything is already in flight.</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {order.map((s, idx) => (
                                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                                        <span className="font-mono text-xs font-bold text-surface-700 w-6">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-surface-900">{s.section.name}</span>
                                                <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge-slate'} text-[10px]`}>{s.status.replace(/_/g, ' ')}</span>
                                                {s.weight_pct > 0 && <span className="text-[11px] text-surface-400">{s.weight_pct.toFixed(2)}% of job</span>}
                                                {s.bottleneck && <span className="badge badge-amber text-[10px]"><i className="fi fi-rr-traffic-cone text-[9px]" /> bottleneck</span>}
                                            </div>
                                            {s.bottleneck && <div className="text-[11px] text-orange-700 mt-0.5">{s.bottleneck.reason}</div>}
                                        </div>
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                            <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                                                className="btn-icon text-surface-400 hover:text-brand-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                                                <i className="fi fi-rr-angle-up text-sm leading-none" />
                                            </button>
                                            <button type="button" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}
                                                className="btn-icon text-surface-400 hover:text-brand-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                                                <i className="fi fi-rr-angle-down text-sm leading-none" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <Link href={`/work-orders/${work_order.id}`} className="btn-outline">Cancel</Link>
                    <button type="button" onClick={save} disabled={saving || order.length === 0} className="btn-primary">
                        <i className="fi fi-rr-shuffle text-xs" /> {saving ? 'Saving…' : 'Save New Order'}
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}
