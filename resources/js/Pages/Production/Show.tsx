import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';
import ProductionMessageThread from '@/Components/Production/ProductionMessageThread';
import PdfPopupModal from '@/Components/PdfPopupModal';

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

interface SectionLite { id: number; name: string; code: string; name_bn?: string | null; }

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
    qty: number | null;
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
    weight_pct: number;
    section_progress: number;
    received_qty: number | null;
    forwarded_qty: number;
    output_qty: number;
    forwardable_qty: number;
    target_qty: number;
    is_last: boolean;
    bottleneck: { reason: string; at: string } | null;
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
    machine_id: number | null;
    sub_section: string | null;
    sub_section_id: number | null;
    estimated_hours: number;
    actual_hours: number;
    weight_pct: number;
    target_qty: number;
    completed_qty: number;
    remaining_qty: number;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    started_at: string | null;
    started_at_iso: string | null;
    completed_at: string | null;
    completed_at_iso: string | null;
    tooling_notes: string | null;
    qc_notes: string | null;
    logs: ProdLog[];
}

interface ProdLog {
    id: number;
    log_date: string | null;
    qty: number;
    hours: number | null;
    machine: string | null;
    operator: string | null;
    remarks: string | null;
    logged_by: string | null;
}

interface OptionLite { id: number; name: string; code?: string; employee_id?: string; section_id?: number | null; }

interface EarlierSection {
    wos_id: number;
    sequence: number;
    section: { name: string; code: string };
    status: string;
}

interface RefFile {
    id: number;
    url: string;
    filename: string | null;
    extension: string | null;
    is_image: boolean;
    kind: 'drawing' | 'sample';
}

interface OpItem {
    item: {
        id: number;
        sequence: number;
        description: string | null;
        quantity: number;
        unit: string;
    } | null;
    sheet_id: number | null;
    sheet_number: string | null;
    references?: RefFile[];
    steps: OpStep[];
}

interface Props {
    wos: Wos;
    routing: RoutingStep[];
    op_items: OpItem[];
    handoffs: Handoff[];
    rework_context: {
        from_section: string;
        transferred_by: string;
        transferred_at: string;
        note: string;
        files: HandoffFile[];
    } | null;
    earlier_sections: EarlierSection[];
    // When opened from a queue item-row, scope the page to that item.
    // siblings_count tells the operator how many other items also need work here.
    scoped_item: {
        id: number;
        sequence: number;
        description: string | null;
        quantity: number;
        unit: string;
    } | null;
    siblings_count: number;
    machines?: OptionLite[];
    operators?: OptionLite[];
    sub_sections?: OptionLite[];
    scoped_sub_section?: { id: number; name: string | null } | null;
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

export default function ProductionShow({ wos, routing, op_items, handoffs, rework_context, earlier_sections, scoped_item, siblings_count, machines = [], operators = [], sub_sections = [], scoped_sub_section = null }: Props) {
    const scopedSub = scoped_sub_section;
    const [showComplete, setShowComplete] = useState(false);
    const [showSendBack, setShowSendBack] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [showBottleneck, setShowBottleneck] = useState(false);
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({ open: false, url: null, title: '' });

    const canAct = ['ready', 'in_progress', 'rework'].includes(wos.status);
    const canSendBack = ['ready', 'in_progress'].includes(wos.status) && earlier_sections.length > 0;
    const isReworkMode = wos.status === 'rework';
    const nf = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    // Section can only be forwarded when every operation step (across every
    // item at this section) is closed. allSteps flattens across items.
    const allSteps = op_items.flatMap((b) => b.steps);
    const openSteps = allSteps.filter((s) => s.status !== 'completed' && s.status !== 'skipped');
    const allStepsDone = allSteps.length === 0 || openSteps.length === 0;
    const completedSteps = allSteps.filter((s) => s.status === 'completed').length;
    const stepProgressPct = allSteps.length === 0 ? 0 : Math.round((completedSteps / allSteps.length) * 100);

    // Items with an operation sheet and/or reference files — drives the sidebar
    // "Documents" card (op-sheet PDF + drawings/samples).
    const docItems = op_items.filter((b) => b.sheet_id || (b.references && b.references.length > 0));

    // A piece can only be transferred once it clears EVERY operation here. If
    // some operations are ahead of others, those extra pieces are "stuck" until
    // the lagging operations catch up — surface that so nobody wonders why the
    // section output (and Transfer) stays at 0.
    const sectionMaxDone = allSteps.length ? Math.max(...allSteps.map((s) => s.completed_qty)) : 0;
    const stuckQty = Math.max(0, sectionMaxDone - wos.output_qty);
    const laggingOps = allSteps
        .filter((s) => s.status !== 'skipped' && s.completed_qty < sectionMaxDone)
        .map((s) => `${s.operation_name} (${nf(s.completed_qty)})`);

    return (
        <AppLayout header={
            scoped_item
                ? `${wos.section.name} — Job# ${wos.work_order.job_number} · Item ${scoped_item.sequence}`
                : `${wos.section.name} — Job# ${wos.work_order.job_number}`
        }>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-xl font-bold text-surface-900">Job# {wos.work_order.job_number}</h2>
                                        {scoped_item && (
                                            <span className="badge badge-amber">Item {scoped_item.sequence}</span>
                                        )}
                                        <JobTypeBadge type={wos.work_order.job_type} />
                                        <span className={`badge ${STATUS_BADGE[wos.status] ?? 'badge-slate'}`}>
                                            {STATUS_LABEL[wos.status] ?? wos.status}
                                        </span>
                                        {wos.weight_pct > 0 && (
                                            <span className="badge badge-violet" title="This shop's share of the whole job, and how much of it is done">
                                                <i className="fi fi-rr-chart-pie-alt text-[9px]" /> {wos.weight_pct.toFixed(2)}% of job · {wos.section_progress}% done
                                            </span>
                                        )}
                                        {scopedSub && (
                                            <span className="badge badge-violet" title="You're viewing only this sub-section's work">
                                                <i className="fi fi-rr-corner-down-right text-[9px]" /> {scopedSub.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600">
                                        <span><i className="fi fi-rr-building text-surface-400" /> {wos.work_order.customer}</span>
                                        <span>
                                            <i className="fi fi-rr-cube text-surface-400" />{' '}
                                            qty {scoped_item ? `${scoped_item.quantity} ${scoped_item.unit}` : wos.work_order.quantity}
                                        </span>
                                        {wos.work_order.due_date && <span><i className="fi fi-rr-calendar text-surface-400" /> Due {wos.work_order.due_date}</span>}
                                    </div>

                                    {/* Partial-forward flow ledger */}
                                    {wos.target_qty > 0 && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                            {wos.received_qty !== null && (
                                                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                                                    <i className="fi fi-rr-inbox-in text-[9px]" /> Received {nf(wos.received_qty)} / {nf(wos.target_qty)}
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <i className="fi fi-rr-box-check text-[9px]" /> Completed here {nf(wos.output_qty)}
                                            </span>
                                            {wos.forwarded_qty > 0 && (
                                                <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                                                    <i className="fi fi-rr-paper-plane text-[9px]" /> Transferred {nf(wos.forwarded_qty)}
                                                </span>
                                            )}
                                            {wos.forwardable_qty > 0 && (
                                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                                                    <i className="fi fi-rr-time-forward text-[9px]" /> Ready to transfer {nf(wos.forwardable_qty)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {/* Why pieces can't move yet — a lagging operation in this section */}
                                    {stuckQty > 0 && laggingOps.length > 0 && (
                                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                            <i className="fi fi-rr-info text-[10px]" /> {nf(stuckQty)} pcs done on some operations can't be transferred yet —
                                            a piece must clear <b>every</b> operation here first. Finish: <b>{laggingOps.join(', ')}</b>.
                                        </div>
                                    )}
                                    {/* Title row priority: scoped item description → WO product. */}
                                    {scoped_item ? (
                                        <p className="text-sm font-semibold text-surface-900 mt-1">{scoped_item.description ?? '—'}</p>
                                    ) : wos.work_order.product ? (
                                        <p className="text-sm text-surface-700 mt-1">{wos.work_order.product}</p>
                                    ) : null}
                                    {/* When scoped, remind the operator that other items also need
                                        to be closed at this section before the WHOLE section forwards. */}
                                    {scoped_item && siblings_count > 0 && (
                                        <p className="text-[11px] text-surface-500 mt-1.5">
                                            <i className="fi fi-rr-info text-[10px] mr-1" />
                                            {siblings_count} other item{siblings_count > 1 ? 's' : ''} at this section also need to be closed before the section can be forwarded.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottleneck banner — flagged for PCD rerouting */}
                {wos.bottleneck && (
                    <div className="card border-orange-300 bg-orange-50/60">
                        <div className="card-body flex items-start gap-3">
                            <i className="fi fi-rr-traffic-cone text-orange-500 text-lg leading-none mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-orange-900">Flagged as a bottleneck · {wos.bottleneck.at}</div>
                                <div className="text-sm text-orange-800 mt-0.5">{wos.bottleneck.reason}</div>
                                <div className="text-[11px] text-orange-600 mt-1">PCD has been notified — they can reroute this job so a free section works first.</div>
                            </div>
                            {canAct && (
                                <button
                                    type="button"
                                    onClick={() => router.delete(`/production/wos/${wos.id}/bottleneck`, { preserveScroll: true })}
                                    className="btn-ghost btn-sm text-orange-700 shrink-0"
                                >
                                    <i className="fi fi-rr-cross-small text-xs" /> Clear flag
                                </button>
                            )}
                        </div>
                    </div>
                )}

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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* ── Left column — routing, operations, queries, handoffs ── */}
                <div className="lg:col-span-2 space-y-6">
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

                {/* This section's operation steps — per item. Each WO item that
                    has work at this section gets its own group so operators can
                    see the part description and close steps per item. */}
                {allSteps.length > 0 && (
                    <div className="card">
                        <div className="card-header flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Operations for this section</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Close each operation as you finish it. Section forwards once all are done.</p>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-xs font-semibold text-surface-700">{completedSteps} of {allSteps.length} done</div>
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
                            {op_items.filter((b) => b.steps.length > 0).map((block, blockIdx) => (
                                <div key={block.item?.id ?? `legacy-${blockIdx}`}>
                                    <div className="px-5 py-2.5 bg-surface-50/70 border-b border-surface-100 flex items-center gap-2 flex-wrap">
                                        {block.item ? (
                                            <>
                                                <span className="badge badge-amber text-[10px]">Item {block.item.sequence}</span>
                                                <span className="text-sm font-semibold text-surface-900 truncate">
                                                    {block.item.description ?? '—'}
                                                </span>
                                                <span className="text-[11px] text-surface-500">
                                                    {wos.received_qty !== null
                                                        ? `Received ${nf(wos.received_qty)} / ${block.item.quantity} ${block.item.unit}`
                                                        : `Qty ${block.item.quantity} ${block.item.unit}`}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-semibold text-surface-700">Shared (WO-level)</span>
                                        )}
                                        {block.sheet_number && (
                                            <span className="ml-auto text-[10px] font-mono text-surface-400">Sheet {block.sheet_number}</span>
                                        )}
                                    </div>
                                    {block.steps.map((s) => (
                                        <OpStepRow key={s.id} step={s} canAct={canAct} machines={machines} operators={operators} subSections={scopedSub ? [] : sub_sections} receivedCap={wos.received_qty} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Production ↔ PCD query threads — one per item's operation sheet.
                    Operator can ask PCD about material, drawings, machine swap, etc. */}
                {op_items
                    .filter((b) => b.sheet_id != null)
                    .map((block) => (
                        <ProductionMessageThread
                            key={`thread-${block.sheet_id}`}
                            sheetId={block.sheet_id as number}
                            viewerRole="production"
                            title={
                                block.item
                                    ? `Queries for Item ${block.item.sequence} — Sheet ${block.sheet_number ?? ''}`
                                    : `Queries — Sheet ${block.sheet_number ?? ''}`
                            }
                            subtitle={
                                block.item
                                    ? `${block.item.description ?? ''}`.slice(0, 120)
                                    : 'Ask PCD if anything is unclear.'
                            }
                        />
                    ))}

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
                </div>{/* left column */}

                {/* ── Right column — actions + documents ── */}
                <div className="space-y-6">
                    {/* Actions */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Actions</h3>
                        </div>
                        <div className="card-body space-y-2">
                            {!scopedSub && canAct && (
                                isReworkMode ? (
                                    <button type="button" onClick={() => setShowComplete(true)} disabled={!allStepsDone}
                                        title={allStepsDone ? '' : `${openSteps.length} operation step(s) still open. Close each step first.`}
                                        className="btn-primary btn-sm w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                        <i className="fi fi-rr-check text-xs" /> Complete Rework &amp; Return
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => setShowTransfer(true)} disabled={wos.forwardable_qty <= 0}
                                        title={wos.forwardable_qty > 0 ? '' : 'No completed pieces to transfer yet. Log some output first.'}
                                        className="btn-primary btn-sm w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                        <i className="fi fi-rr-paper-plane text-xs" /> {wos.is_last ? 'Transfer & Send to QC' : 'Transfer to next section'}
                                    </button>
                                )
                            )}
                            {!scopedSub && canSendBack && (
                                <button type="button" onClick={() => setShowSendBack(true)}
                                    className="btn-outline btn-sm w-full justify-center border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400">
                                    <i className="fi fi-rr-undo-alt text-xs" /> Send Back
                                </button>
                            )}
                            {!scopedSub && canAct && !isReworkMode && !wos.bottleneck && (
                                <button type="button" onClick={() => setShowBottleneck(true)}
                                    className="btn-sm w-full justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-colors">
                                    <i className="fi fi-rr-traffic-cone text-xs leading-none" /> Flag Bottleneck
                                </button>
                            )}
                            {scopedSub && (
                                <div className="text-[11px] text-surface-400 text-center px-2 py-1">
                                    Transfers &amp; handoffs are handled by the shop in-charge.
                                </div>
                            )}
                            <Link href={`/maintenance-requests/create?section_id=${wos.section.id}`}
                                className="btn-sm w-full justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors">
                                <i className="fi fi-rr-wrench-simple text-xs leading-none" /> Request Maintenance
                            </Link>
                            <Link href={`/production/work-orders/${wos.work_order.id}/cycle`} className="btn-outline btn-sm w-full justify-center">
                                <i className="fi fi-rr-time-past text-xs" /> Full Cycle
                            </Link>
                            <Link href="/production/queue" className="btn-ghost btn-sm w-full justify-center">
                                <i className="fi fi-rr-arrow-left text-xs" /> Back to Queue
                            </Link>
                        </div>
                    </div>

                    {/* Documents — operation sheet + reference drawings/samples */}
                    {docItems.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Documents</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Operation sheet &amp; references</p>
                            </div>
                            <div className="card-body space-y-4">
                                {docItems.map((block, i) => (
                                    <div key={block.item?.id ?? `doc-${i}`} className="space-y-2">
                                        {docItems.length > 1 && block.item && (
                                            <div className="flex items-center gap-2 text-[11px] text-surface-600">
                                                <span className="badge badge-amber text-[10px]">Item {block.item.sequence}</span>
                                                <span className="truncate">{block.item.description}</span>
                                            </div>
                                        )}
                                        {block.sheet_id && (
                                            <button type="button"
                                                onClick={() => setPdfPopup({
                                                    open: true,
                                                    url: `/production/op-sheets/${block.sheet_id}/pdf?preview=base64`,
                                                    title: 'Operation Sheet',
                                                    subtitle: block.sheet_number ? `Sheet ${block.sheet_number}` : (block.item?.description ?? undefined),
                                                })}
                                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-500 shadow-sm transition-colors">
                                                <i className="fi fi-rr-file-pdf text-xs leading-none" /> View Operation Sheet
                                                {block.sheet_number && <span className="font-mono font-normal opacity-80">· {block.sheet_number}</span>}
                                            </button>
                                        )}
                                        {block.references && block.references.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
                                                    <i className="fi fi-rr-paperclip text-[9px]" /> Reference — drawings &amp; samples
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {block.references.map((r) => <ReferenceChip key={`${r.kind}-${r.id}`} r={r} />)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                </div>{/* grid */}
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
            {showTransfer && (
                <TransferModal
                    wosId={wos.id}
                    forwardable={wos.forwardable_qty}
                    isLast={wos.is_last}
                    onClose={() => setShowTransfer(false)}
                />
            )}
            {showBottleneck && (
                <BottleneckModal wosId={wos.id} onClose={() => setShowBottleneck(false)} />
            )}
            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}

function OpStepRow({ step, canAct, machines, operators, subSections, receivedCap }: { step: OpStep; canAct: boolean; machines: OptionLite[]; operators: OptionLite[]; subSections: OptionLite[]; receivedCap: number | null }) {
    const [busy, setBusy] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        qty: '', machine_id: step.machine_id ? String(step.machine_id) : '', operator_id: '', log_date: today, remarks: '',
    });

    const hasQty = step.target_qty > 0;
    // Downstream sections can only work what they've RECEIVED — cap the working
    // target by the section's received qty (null = ungated first section).
    const effTarget = receivedCap !== null ? Math.min(step.target_qty, receivedCap) : step.target_qty;
    const effRemaining = Math.max(0, effTarget - step.completed_qty);
    const isCapped = receivedCap !== null && effTarget < step.target_qty;
    const pct = hasQty && effTarget > 0 ? Math.min(100, Math.round((step.completed_qty / effTarget) * 100)) : 0;
    const fmtQty = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    const fire = (action: 'start' | 'complete' | 'reopen') => {
        setBusy(true);
        router.post(`/production/op-steps/${step.id}/mark`, { action }, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
        });
    };

    const submitLog = () => {
        if (!form.qty || parseFloat(form.qty) <= 0) return;
        setBusy(true);
        router.post(`/production/op-steps/${step.id}/log`, {
            qty: form.qty,
            machine_id: form.machine_id || undefined,
            operator_id: form.operator_id || undefined,
            log_date: form.log_date,
            remarks: form.remarks || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => { setLogOpen(false); setForm(f => ({ ...f, qty: '', remarks: '' })); },
            onFinish: () => setBusy(false),
        });
    };

    const deleteLog = (id: number) => {
        if (!confirm('Remove this production log entry?')) return;
        router.delete(`/production/production-logs/${id}`, { preserveScroll: true });
    };

    // Shop in-charge assigns the step to one of the shop's sub-sections.
    const assignSub = (subId: string) => {
        router.post(`/production/op-steps/${step.id}/assign-sub-section`,
            { sub_section_id: subId || undefined },
            { preserveScroll: true });
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
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 flex-wrap">
                        {subSections.length > 0 && canAct ? (
                            <span className="inline-flex items-center gap-1">
                                <i className="fi fi-rr-corner-down-right text-[10px] text-violet-500" />
                                <select
                                    value={step.sub_section_id ?? ''}
                                    onChange={(e) => assignSub(e.target.value)}
                                    disabled={busy}
                                    className={`text-[11px] py-0.5 pl-1.5 pr-5 rounded-md border outline-none ${step.sub_section_id ? 'border-violet-200 bg-violet-50 text-violet-700 font-semibold' : 'border-dashed border-surface-300 text-surface-500'}`}
                                    title="Assign this step to a sub-section"
                                >
                                    <option value="">Assign sub-section…</option>
                                    {subSections.map((ss) => (
                                        <option key={ss.id} value={ss.id}>{ss.name}{ss.code ? ` (${ss.code})` : ''}</option>
                                    ))}
                                </select>
                            </span>
                        ) : (
                            step.sub_section && <span className="text-violet-600"><i className="fi fi-rr-corner-down-right text-[10px]" /> {step.sub_section}</span>
                        )}
                        {step.machine && <span><i className="fi fi-rr-settings text-[10px]" /> {step.machine}</span>}
                        {step.operator && <span><i className="fi fi-rr-user text-[10px]" /> {step.operator}</span>}
                        {step.estimated_hours > 0 && <span><i className="fi fi-rr-clock text-[10px]" /> est {step.estimated_hours.toFixed(1)}h</span>}
                        {step.actual_hours > 0 && <span className="text-emerald-600">· actual {step.actual_hours.toFixed(2)}h</span>}
                    </div>

                    {/* Quantity progress */}
                    {hasQty && (
                        <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-surface-600">
                                    Completed <span className="font-bold text-surface-900">{fmtQty(step.completed_qty)}</span> / {fmtQty(effTarget)}
                                    {effRemaining > 0 && <span className="text-amber-600"> · {fmtQty(effRemaining)} left</span>}
                                    {isCapped && <span className="text-surface-400"> (of {fmtQty(step.target_qty)} total)</span>}
                                </span>
                                <span className="font-bold text-surface-700">{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Live running timer — only for legacy Start/Complete steps.
                        In qty-mode a step spans many days of partial output, so a
                        wall-clock timer since first log is misleading; actual time
                        lives in each daily log's hours instead. */}
                    {!hasQty && step.status === 'in_progress' && step.started_at_iso && (
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

                    {/* Daily production log entry form */}
                    {canAct && hasQty && logOpen && (
                        <div className="mt-3 p-3 rounded-xl border border-brand-200 bg-brand-50/40 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                    <label className="text-[10px] font-semibold text-surface-500 uppercase">Qty completed *</label>
                                    <input type="number" min="0" step="any" value={form.qty}
                                        onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                                        max={effRemaining || undefined}
                                        className="form-input w-full text-sm py-1.5" placeholder={`max ${fmtQty(effRemaining)}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-surface-500 uppercase">Date</label>
                                    <input type="date" value={form.log_date}
                                        onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                                        className="form-input w-full text-sm py-1.5" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-surface-500 uppercase">Machine <span className="text-surface-400 normal-case font-normal">(optional)</span></label>
                                    <select value={form.machine_id} onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))} className="form-select w-full text-sm py-1.5">
                                        <option value="">—</option>
                                        {machines.map(m => <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-surface-500 uppercase">Operator <span className="text-surface-400 normal-case font-normal">(optional)</span></label>
                                    <select value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))} className="form-select w-full text-sm py-1.5">
                                        <option value="">—</option>
                                        {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <input type="text" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                                className="form-input w-full text-sm py-1.5" placeholder="Remarks (optional)…" />
                            <div className="flex items-center gap-2 justify-end">
                                <button type="button" onClick={() => setLogOpen(false)} className="btn-ghost btn-sm" disabled={busy}>Cancel</button>
                                <button type="button" onClick={submitLog} disabled={busy || !form.qty} className="btn-primary btn-sm">
                                    <i className="fi fi-rr-disk text-xs" /> {busy ? 'Saving…' : 'Log Output'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Production log history */}
                    {step.logs.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {step.logs.map(l => (
                                <div key={l.id} className="flex items-center gap-2 text-[11px] text-surface-600 bg-surface-50 rounded-lg px-2.5 py-1.5">
                                    <span className="font-mono font-semibold text-surface-800">{fmtQty(l.qty)}</span>
                                    <span className="text-surface-400">pcs ·</span>
                                    <span>{l.log_date}</span>
                                    {l.machine && <span className="text-surface-400">· {l.machine}</span>}
                                    {l.operator && <span className="text-surface-400">· {l.operator}</span>}
                                    {l.remarks && <span className="text-surface-400 truncate">· {l.remarks}</span>}
                                    {l.logged_by && <span className="text-surface-300 ml-auto">by {l.logged_by}</span>}
                                    {canAct && (
                                        <button type="button" onClick={() => deleteLog(l.id)} className="text-rose-500 hover:text-rose-700 shrink-0" title="Remove">
                                            <i className="fi fi-rr-trash text-[10px] leading-none" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {canAct && (
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {hasQty ? (
                            step.status !== 'completed' ? (
                                <button type="button" onClick={() => setLogOpen(o => !o)} disabled={busy || effRemaining <= 0}
                                    title={effRemaining <= 0 ? 'All received pieces are done — waiting for the previous section to transfer more.' : ''}
                                    className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                    <i className="fi fi-rr-plus text-xs" /> Log Output
                                </button>
                            ) : (
                                <span className="badge badge-green text-[10px]"><i className="fi fi-rr-check-circle text-[9px]" /> Done</span>
                            )
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ReferenceChip({ r }: { r: RefFile }) {
    const kindColor = r.kind === 'drawing' ? 'text-violet-700' : 'text-emerald-700';
    return (
        <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white p-1.5 pr-3 shadow-sm">
            {r.is_image ? (
                <a href={r.url} target="_blank" rel="noreferrer" title="View full image" className="shrink-0">
                    <img src={r.url} alt={r.filename ?? ''} className="w-12 h-12 rounded-lg object-cover border border-surface-100" />
                </a>
            ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-50 border border-surface-100 flex items-center justify-center text-[9px] font-bold text-surface-500 shrink-0">
                    {r.extension ?? 'FILE'}
                </div>
            )}
            <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wide ${kindColor}`}>{r.kind}</div>
                <div className="text-[11px] text-surface-700 truncate max-w-[140px]" title={r.filename ?? ''}>{r.filename ?? '—'}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-brand-600 hover:text-brand-700">
                        <i className="fi fi-rr-eye text-[9px]" /> View
                    </a>
                    <a href={r.url} download className="text-[10px] font-semibold text-surface-500 hover:text-surface-700">
                        <i className="fi fi-rr-download text-[9px]" /> Download
                    </a>
                </div>
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
                {h.qty !== null && (
                    <span className="badge badge-violet text-[10px]">{Number(h.qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })} pcs</span>
                )}
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

function TransferModal({ wosId, forwardable, isLast, onClose }: { wosId: number; forwardable: number; isLast: boolean; onClose: () => void }) {
    const nf = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const [qty, setQty] = useState(String(forwardable));
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const q = parseFloat(qty);
    const valid = q > 0 && q <= forwardable + 0.001;

    const submit = () => {
        if (!valid) return;
        setSubmitting(true);
        router.post(`/production/wos/${wosId}/transfer`, { qty, note: note || undefined }, {
            preserveScroll: true,
            onFinish: () => setSubmitting(false),
            onSuccess: onClose,
        });
    };

    return (
        <ModalShell title={isLast ? 'Transfer & Send to QC' : 'Transfer to Next Section'} onClose={onClose} disabled={submitting}>
            <div className="p-5 space-y-4 overflow-y-auto">
                <div className="text-sm text-surface-700">
                    {isLast
                        ? 'Send finished pieces from this section to QC. Only the quantity you transfer moves on — transfer the rest later.'
                        : 'Send finished pieces to the next section. Only the quantity you transfer becomes available there — you can transfer the remaining pieces later.'}
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-800">
                    <i className="fi fi-rr-box-check text-xs" /> Ready to transfer: <span className="font-bold">{nf(forwardable)}</span> pcs
                </div>
                <div className="form-group">
                    <label className="form-label">Quantity to transfer <span className="text-red-500">*</span></label>
                    <input type="number" min="0" step="any" max={forwardable} value={qty}
                        onChange={(e) => setQty(e.target.value)} className="form-input"
                        placeholder={`max ${nf(forwardable)}`} />
                    {!valid && qty !== '' && <p className="form-error">Enter a quantity between 0 and {nf(forwardable)}.</p>}
                </div>
                <div className="form-group">
                    <label className="form-label">Handoff Note <span className="form-label-optional">optional</span></label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="form-input"
                        style={{ resize: 'vertical' }} placeholder="Anything the next section should know…" />
                </div>
            </div>
            <ModalFooter onClose={onClose} onSubmit={submit} submitting={submitting} submitDisabled={!valid}
                submitLabel={isLast ? 'Transfer & Send to QC' : 'Transfer'} />
        </ModalShell>
    );
}

function BottleneckModal({ wosId, onClose }: { wosId: number; onClose: () => void }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const valid = reason.trim().length >= 3;

    const submit = () => {
        if (!valid) return;
        setSubmitting(true);
        router.post(`/production/wos/${wosId}/bottleneck`, { reason }, {
            preserveScroll: true,
            onFinish: () => setSubmitting(false),
            onSuccess: onClose,
        });
    };

    return (
        <ModalShell title="Flag as Bottleneck" onClose={onClose} disabled={submitting} accent="rose">
            <div className="p-5 space-y-4 overflow-y-auto">
                <div className="text-sm text-surface-700">
                    Machines or manpower here tied up on other work? Flag this job so PCD can reroute it —
                    let a free section do its part first instead of the job waiting.
                </div>
                <div className="form-group">
                    <label className="form-label">Reason <span className="text-red-500">*</span></label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="form-input"
                        style={{ resize: 'vertical' }} placeholder="e.g. All lathes running Job 37711 till Thursday — can't start this before then." />
                    <p className="form-hint">Minimum 3 characters.</p>
                </div>
            </div>
            <ModalFooter onClose={onClose} onSubmit={submit} submitting={submitting} submitDisabled={!valid}
                submitLabel="Flag for PCD" submitAccent="red" />
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
