import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import EstimateEditor, { newLine } from '@/Components/CostEstimate/EstimateEditor';

const fmt = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const APPROVAL: Record<string, { label: string; cls: string }> = {
    not_submitted:    { label: 'Not submitted',    cls: 'bg-surface-100 text-surface-600 border-surface-200' },
    pending_approval: { label: 'Pending approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved:         { label: 'Approved',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected:         { label: 'Rejected',         cls: 'bg-red-50 text-red-700 border-red-200' },
};

/** Same maths as CostEstimate::recalculate() — the live figure while typing. */
function grandOf(d: any): number {
    const lines: any[] = d.lines ?? [];
    const net = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);
    const afterOH = net + net * ((parseFloat(d.overhead_pct) || 0) / 100) + (parseFloat(d.extra_cost) || 0);
    const total = afterOH * (1 + ((parseFloat(d.vat_pct) || 0) + (parseFloat(d.tax_pct) || 0)) / 100);
    const auto = total * (parseFloat(d.times_multiplier) || 1) * (parseInt(d.job_quantity) || 1);
    return Number(d.grand_total_override) > 0 ? Number(d.grand_total_override) : auto;
}

interface Entry {
    part_id: number | null;
    part_no: string;
    name: string;
    quantity: number;
    unit: string;
    estimate_id: number | null;
    estimate_no: string | null;
    approval_status: string | null;
    grand_total: number | null;
    data: any;
}

/**
 * Edit every part estimate of a job on one page.
 *
 * Each part gets the full estimate editor. Nothing is saved until Save All,
 * which sends only the parts that actually changed (plus any newly started)
 * — so an untouched part, and its approval, are never disturbed.
 */
/** Blank rows so a freshly started part looks like the normal New Estimate form. */
const withStarterRows = (e: Entry): Entry => (e.estimate_id || (e.data.lines ?? []).length > 0)
    ? e
    : { ...e, data: { ...e.data, lines: (['material', 'machining', 'surface', 'other'] as const).map(newLine) } };

export default function JobCostingEdit({ job, entries, materials, operations, customers, startAll = false }: any) {
    const [parts, setParts] = useState<Entry[]>(() => entries.map(withStarterRows));
    // Snapshot of what was loaded — "changed" means differs from this.
    const [baseline] = useState<string[]>(() => entries.map((e: Entry) => JSON.stringify(e.data)));
    const uncostedIdx: number[] = entries.map((e: Entry, i: number) => (e.estimate_id ? -1 : i)).filter((i: number) => i >= 0);
    const [started, setStarted] = useState<Set<number>>(() => new Set(startAll ? uncostedIdx : []));
    // Open the first part to work on; a single-part job just opens.
    const [open, setOpen] = useState<Set<number>>(() =>
        new Set(startAll && uncostedIdx.length ? [uncostedIdx[0]] : entries.length === 1 ? [0] : []));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const isDirty = (i: number) => JSON.stringify(parts[i].data) !== baseline[i];
    // A new part is only worth saving once it has at least one cost line —
    // otherwise starting all parts would create ৳0 estimates for the ones
    // left untouched, and they'd stop showing as "not costed".
    const hasContent = (i: number) => (parts[i].data.lines ?? [])
        .some((l: any) => (l.description ?? '').trim() !== '' || l.material_id || l.operation_id);
    const isIncluded = (i: number) => parts[i].estimate_id ? isDirty(i) : started.has(i) && hasContent(i);
    const includedIdx = parts.map((_, i) => i).filter(isIncluded);
    const hasChanges = includedIdx.length > 0;

    // Leaving with unsaved edits across several parts would lose a lot of work.
    useEffect(() => {
        if (!hasChanges || saving) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasChanges, saving]);

    // Inertia-style setData for one part. Functional, so the editor can call
    // it several times in a row (pricing group, then re-priced lines).
    const setterFor = (i: number) => (keyOrData: any, value?: any) =>
        setParts(prev => prev.map((p, idx) => {
            if (idx !== i) return p;
            const next = typeof keyOrData === 'function'
                ? keyOrData(p.data)
                : typeof keyOrData === 'string'
                    ? { ...p.data, [keyOrData]: value }
                    : keyOrData;
            return { ...p, data: next };
        }));

    const toggle = (i: number) => setOpen(prev => {
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
    });

    const startPart = (i: number) => {
        setStarted(prev => new Set(prev).add(i));
        setOpen(prev => new Set(prev).add(i));
    };

    const liveTotals = useMemo(() => parts.map((p, i) =>
        p.estimate_id || started.has(i) ? grandOf(p.data) : 0
    ), [parts, started]);
    const jobTotal = liveTotals.reduce((s, v) => s + v, 0);
    const uncosted = parts.filter((p, i) => !p.estimate_id && !(started.has(i) && hasContent(i))).length;

    // Errors come back as estimates.N.field where N indexes the SENT array.
    const errorsForPart = (i: number): Record<string, string> => {
        const pos = includedIdx.indexOf(i);
        if (pos < 0) return {};
        const prefix = `estimates.${pos}.`;
        return Object.fromEntries(
            Object.entries(errors).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v])
        );
    };

    const saveAll = () => {
        if (!hasChanges) return;

        const resetting = includedIdx
            .filter(i => ['approved', 'pending_approval'].includes(parts[i].approval_status ?? ''))
            .map(i => `${parts[i].part_no} ${parts[i].name} (${parts[i].estimate_no})`);
        if (resetting.length > 0 && !confirm(
            `These estimates are approved or awaiting approval:\n\n• ${resetting.join('\n• ')}\n\n`
            + 'Saving your changes will reset their approval, and they will need to be submitted again. Continue?'
        )) return;

        const sent = includedIdx;
        setSaving(true);
        setErrors({});
        router.put(`/cost-estimates/job/${job.rfq_item_id}`, {
            estimates: sent.map(i => ({
                id: parts[i].estimate_id,
                rfq_item_part_id: parts[i].part_id,
                rfq_item_id: job.rfq_item_id,
                ...parts[i].data,
            })),
        }, {
            preserveScroll: true,
            onError: (errs) => {
                setErrors(errs as any);
                // Open every part that has an error so it can't hide.
                setOpen(prev => {
                    const next = new Set(prev);
                    Object.keys(errs).forEach(k => {
                        const m = /^estimates\.(\d+)\./.exec(k);
                        if (m && sent[Number(m[1])] !== undefined) next.add(sent[Number(m[1])]);
                    });
                    return next;
                });
            },
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout header="Edit Job Costing">
            <div className="max-w-7xl space-y-4 animate-fade-in pb-8">

                {/* Header */}
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-1">
                                Edit Job Costing · RFQ #{job.rfq_id}
                            </div>
                            <h2 className="text-lg font-bold text-surface-900">{job.job_description}</h2>
                            <div className="text-xs text-surface-500 mt-1">
                                Customer: <span className="font-semibold text-surface-700">{job.customer}</span>
                                {' · '}Job quantity: <span className="font-semibold text-surface-700">{job.job_quantity} {job.job_unit}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setOpen(new Set(parts.map((_, i) => i).filter(i => parts[i].estimate_id || started.has(i))))}
                                className="btn-ghost btn-sm">
                                <i className="fi fi-rr-expand text-xs leading-none" /> Expand all
                            </button>
                            <button type="button" onClick={() => setOpen(new Set())} className="btn-ghost btn-sm">
                                <i className="fi fi-rr-compress text-xs leading-none" /> Collapse all
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    <i className="fi fi-rr-info text-blue-500 text-sm leading-none mt-0.5" />
                    <div>
                        Each part below is its own cost estimate with every tool of the normal estimate form. Changes are
                        kept on this page until <span className="font-semibold">Save All</span>. Only parts you actually changed
                        are saved — and an <span className="font-semibold">approved or pending</span> estimate you change will
                        have its approval reset.
                    </div>
                </div>

                {/* One editor per part */}
                {parts.map((p, i) => {
                    const exists = !!p.estimate_id;
                    const active = exists || started.has(i);
                    const dirty = active && (exists ? isDirty(i) : hasContent(i));
                    const emptyNew = !exists && started.has(i) && !hasContent(i);
                    const decided = ['approved', 'pending_approval'].includes(p.approval_status ?? '');
                    const ap = APPROVAL[p.approval_status ?? ''] ?? null;
                    const partErrors = errorsForPart(i);
                    const hasErr = Object.keys(partErrors).length > 0;

                    return (
                        <div key={i} className={`rounded-2xl border-2 ${hasErr ? 'border-red-300' : dirty ? 'border-brand-300' : 'border-surface-200'} bg-white`}>
                            <button type="button"
                                onClick={() => active ? toggle(i) : startPart(i)}
                                className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left">
                                <span className="shrink-0 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {p.part_no}
                                </span>
                                <span className="font-semibold text-surface-900">{p.name}</span>
                                <span className="text-xs text-surface-400">×{p.quantity} {p.unit}</span>
                                {p.estimate_no && <span className="font-mono text-[10px] font-bold text-brand-600">{p.estimate_no}</span>}
                                {ap && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${ap.cls}`}>{ap.label}</span>}
                                {dirty && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 font-semibold">{exists ? 'Changed' : 'New'}</span>}
                                {emptyNew && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 border border-surface-200 font-semibold"
                                        title="Add at least one cost line — an empty part is not saved">
                                        empty — not saved yet
                                    </span>
                                )}
                                {dirty && decided && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                        approval will reset
                                    </span>
                                )}
                                {hasErr && <span className="badge badge-red">needs attention</span>}

                                <span className="ml-auto flex items-center gap-3">
                                    {active ? (
                                        <>
                                            <span className="font-bold text-surface-900 tabular-nums">{fmt(liveTotals[i])}</span>
                                            <i className={`fi ${open.has(i) ? 'fi-rr-angle-small-up' : 'fi-rr-angle-small-down'} text-base leading-none text-surface-500`} />
                                        </>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 text-xs font-semibold">
                                            <i className="fi fi-rr-plus text-[10px] leading-none" /> Start estimate for this part
                                        </span>
                                    )}
                                </span>
                            </button>

                            {active && open.has(i) && (
                                <div className="px-4 pb-4 pt-1 space-y-6 border-t border-surface-100">
                                    <EstimateEditor
                                        data={p.data}
                                        setData={setterFor(i)}
                                        errors={partErrors}
                                        materials={materials}
                                        operations={operations}
                                        customers={customers}
                                        hideCustomer
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Save bar — sticky at the bottom of the content */}
                <div className="sticky bottom-4 z-30">
                    <div className="rounded-2xl bg-surface-900 text-white shadow-premium-lg px-5 py-3 flex flex-wrap items-center gap-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Job total (live)</div>
                            <div className="text-xl font-bold tabular-nums">{fmt(jobTotal)}</div>
                        </div>
                        <div className="text-xs text-white/60">
                            {hasChanges
                                ? `${includedIdx.length} part${includedIdx.length === 1 ? '' : 's'} to save`
                                : 'No changes yet'}
                            {uncosted > 0 && <span className="text-amber-300"> · {uncosted} part{uncosted === 1 ? '' : 's'} not estimated</span>}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <Link href={`/cost-estimates/job/${job.rfq_item_id}`}
                                className="px-3 py-2 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10">
                                Cancel
                            </Link>
                            <button type="button" onClick={saveAll} disabled={!hasChanges || saving}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed">
                                {saving ? 'Saving…' : 'Save All'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </AppLayout>
    );
}
