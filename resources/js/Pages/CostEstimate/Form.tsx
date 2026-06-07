import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState, useCallback, useRef } from 'react';
import WeightCalculator from '@/Components/Widgets/WeightCalculator';
import SearchableSelect from '@/Components/SearchableSelect';
import axios from 'axios';

interface Line {
    section: 'material' | 'machining' | 'surface' | 'other';
    material_id?: number | null;
    operation_id?: number | null;
    description: string;
    quantity: string;
    unit: string;
    rate: string;
}

const newLine = (section: Line['section']): Line => ({
    section, material_id: null, operation_id: null,
    description: '', quantity: '', unit: section === 'material' ? 'kg' : 'hour', rate: '',
});

const fmt = (n: number) => `৳${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Pick the right per-group rate column off a MachiningOperation row. */
function opRateForGroup(op: any, group: string): number | null {
    if (!op) return null;
    switch (group) {
        case 'A':       return op.rate_group_a;
        case 'B':       return op.rate_group_b;
        case 'C':       return op.rate_group_c;
        case 'STUDENT': return op.rate_group_student;
        case 'PUBLIC':  return op.rate_group_public;
        default:        return op.rate_group_b;
    }
}

const PRICING_GROUPS = [
    { value: 'A',       label: 'Group A' },
    { value: 'B',       label: 'Group B' },
    { value: 'C',       label: 'Group C' },
    { value: 'STUDENT', label: 'Student' },
    { value: 'PUBLIC',  label: 'Public' },
] as const;

export default function CostEstimateForm({ estimate, rfq, rfqItem, materials, operations, customers }: any) {
    const isEdit = !!estimate;

    const initLines = (section: Line['section']) =>
        estimate?.lines?.filter((l: any) => l.section === section).map((l: any) => ({
            section: l.section, material_id: l.material_id, operation_id: l.operation_id,
            description: l.description, quantity: String(l.quantity), unit: l.unit, rate: String(l.rate),
        })) ?? [newLine(section)];

    // Pre-fill from RFQ item context if creating
    const defaultJobName = estimate?.job_name
        ?? rfqItem?.job_description
        ?? '';
    const defaultJobQty = estimate?.job_quantity
        ?? (rfqItem?.quantity ? Number(rfqItem.quantity) : 1);

    const { data, setData, post, put, processing, errors } = useForm<any>({
        rfq_id:           estimate?.rfq_id ?? rfqItem?.rfq_id ?? rfq?.id ?? null,
        rfq_item_id:      estimate?.rfq_item_id ?? rfqItem?.id ?? null,
        customer_id:      estimate?.customer_id ?? rfqItem?.customer_id ?? rfq?.customer_id ?? '',
        company_name:     estimate?.company_name ?? rfqItem?.customer_name ?? rfq?.customer_name ?? '',
        job_name:         defaultJobName,
        part_no:          estimate?.part_no ?? '',
        actual_size:      estimate?.actual_size ?? '',
        materials_size:   estimate?.materials_size ?? '',
        pricing_group:    estimate?.pricing_group ?? 'B',
        overhead_pct:     estimate?.overhead_pct ?? 25,
        vat_pct:          estimate?.vat_pct ?? 15,
        tax_pct:          estimate?.tax_pct ?? 0,
        times_multiplier: estimate?.times_multiplier ?? 1,
        job_quantity:     defaultJobQty,
        notes:            estimate?.notes ?? '',
        lines: [
            ...initLines('material'),
            ...initLines('machining'),
            ...initLines('surface'),
            ...initLines('other'),
        ] as Line[],
    });

    const [weightCalcOpen, setWeightCalcOpen] = useState(false);
    const [weightTargetIdx, setWeightTargetIdx] = useState<number | null>(null);

    // ── AI: Rate Suggestions ──
    const [rateSuggestions, setRateSuggestions] = useState<Record<number, any>>({});
    const [rateSugLoading, setRateSugLoading] = useState<number | null>(null);

    const fetchRateSuggestion = useCallback(async (idx: number, line: Line) => {
        const params: any = { section: line.section };
        if (line.material_id) params.material_id = line.material_id;
        else if (line.operation_id) params.operation_id = line.operation_id;
        else if (line.description?.length >= 3) params.description = line.description;
        else return;

        setRateSugLoading(idx);
        try {
            const { data: res } = await axios.get('/api/cost-estimates/rate-suggestions', { params });
            if (res.suggestions) setRateSuggestions(prev => ({ ...prev, [idx]: res.suggestions }));
        } catch {} finally {
            setRateSugLoading(null);
        }
    }, []);

    // ── AI: Find Similar Job ──
    const [similarMatch, setSimilarMatch] = useState<any>(null);
    const [similarLoading, setSimilarLoading] = useState(false);
    const [applyPhase, setApplyPhase] = useState<'idle' | 'analyzing' | 'applying' | 'done'>('idle');
    const formRef = useRef<HTMLFormElement>(null);

    const findSimilarJob = async () => {
        if (!data.job_name && !data.customer_id) return;
        setSimilarLoading(true);
        try {
            const { data: res } = await axios.get('/api/cost-estimates/find-similar', {
                params: { job_name: data.job_name, customer_id: data.customer_id },
            });
            setSimilarMatch(res.match);
        } catch {} finally {
            setSimilarLoading(false);
        }
    };

    const applyFromSimilar = async () => {
        if (!similarMatch) return;
        const m = similarMatch;

        // Phase 1: Analyzing
        setApplyPhase('analyzing');
        await new Promise(r => setTimeout(r, 800));

        // Phase 2: Applying
        setApplyPhase('applying');
        await new Promise(r => setTimeout(r, 600));

        // Apply structure (overhead, vat, sizes) but keep user's job_quantity & pricing_group
        // Re-calculate operation rates based on current pricing group
        const currentGroup = data.pricing_group;
        const adjustedLines = (m.lines ?? []).map((line: any) => {
            const adjusted = { ...line };

            // For operations: re-apply rate based on current pricing group
            if (line.operation_id) {
                const op = operations.find((o: any) => o.id === line.operation_id);
                if (op) {
                    const rate = opRateForGroup(op, currentGroup);
                    adjusted.rate = String(rate ?? line.rate);
                }
            }

            // For materials: use current catalog rate (may have changed since the old estimate)
            if (line.material_id) {
                const mat = materials.find((m: any) => m.id === line.material_id);
                if (mat) {
                    adjusted.rate = String(mat.rate_per_kg ?? line.rate);
                }
            }

            // Keep quantity as reference but user can adjust
            return adjusted;
        });

        setData({
            ...data,
            // Apply structure settings
            overhead_pct: m.overhead_pct ?? data.overhead_pct,
            vat_pct: m.vat_pct ?? data.vat_pct,
            times_multiplier: m.times_multiplier ?? data.times_multiplier,
            part_no: data.part_no || m.part_no || '',
            actual_size: data.actual_size || m.actual_size || '',
            materials_size: data.materials_size || m.materials_size || '',
            // Keep user's own values for these:
            // job_name — user already entered it
            // customer_id — user already selected
            // job_quantity — user determines this
            // pricing_group — user already selected
            // Apply adjusted lines
            lines: adjustedLines,
        });
        // Phase 3: Done
        setApplyPhase('done');
        await new Promise(r => setTimeout(r, 1200));
        setApplyPhase('idle');
        setSimilarMatch(null);

        // Smooth scroll to the first line section
        setTimeout(() => {
            document.getElementById('section-material')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    };

    // ── Group operations by category for the dropdown ────────
    const opsByCategory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        operations.forEach((o: any) => {
            (groups[o.category] ??= []).push(o);
        });
        return groups;
    }, [operations]);

    // ── Helpers to update lines ────────────────────────────────
    const updateLine = (idx: number, patch: Partial<Line>) => {
        const next = [...data.lines];
        next[idx] = { ...next[idx], ...patch } as Line;
        setData('lines', next);
    };

    const addLine = (section: Line['section']) => {
        setData('lines', [...data.lines, newLine(section)]);
    };

    const removeLine = (idx: number) => {
        setData('lines', data.lines.filter((_: Line, i: number) => i !== idx));
    };

    const onMaterialChange = (idx: number, materialId: string) => {
        const mat = materials.find((m: any) => m.id === Number(materialId));
        if (mat) {
            updateLine(idx, {
                material_id: mat.id,
                description: mat.name,
                rate: String(mat.rate_per_kg),
                unit: 'kg',
            });
        } else {
            updateLine(idx, { material_id: null });
        }
    };

    const onOperationChange = (idx: number, operationId: string) => {
        const op = operations.find((o: any) => o.id === Number(operationId));
        if (op) {
            const rate = opRateForGroup(op, data.pricing_group);
            updateLine(idx, {
                operation_id: op.id,
                description: op.name,
                rate: String(rate ?? 0),
                unit: op.default_unit,
            });
        } else {
            updateLine(idx, { operation_id: null });
        }
    };

    // When pricing group changes, refresh all operation rates
    const onGroupChange = (group: string) => {
        setData('pricing_group', group);
        const next = data.lines.map((l: Line) => {
            if (l.operation_id) {
                const op = operations.find((o: any) => o.id === l.operation_id);
                if (op) {
                    const rate = opRateForGroup(op, group);
                    return { ...l, rate: String(rate ?? 0) };
                }
            }
            return l;
        });
        setData('lines', next);
    };

    // ── Live totals ────────────────────────────────────────────
    const lineAmount = (l: Line) => (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
    const sectionTotal = (section: Line['section']) =>
        data.lines.filter((l: Line) => l.section === section).reduce((s: number, l: Line) => s + lineAmount(l), 0);

    const totals = useMemo(() => {
        const material  = sectionTotal('material');
        const machining = sectionTotal('machining');
        const surface   = sectionTotal('surface');
        const other     = sectionTotal('other');
        const net       = material + machining + surface + other;
        const overhead  = net * ((parseFloat(data.overhead_pct) || 0) / 100);
        const afterOH   = net + overhead;
        const vat       = afterOH * ((parseFloat(data.vat_pct) || 0) / 100);
        const tax       = afterOH * ((parseFloat(data.tax_pct) || 0) / 100);
        const total     = afterOH + vat + tax;
        const withTimes = total * (parseFloat(data.times_multiplier) || 1);
        const grand     = withTimes * (parseInt(data.job_quantity) || 1);
        return { material, machining, surface, other, net, overhead, afterOH, vat, tax, total: withTimes, grand };
    }, [data.lines, data.overhead_pct, data.vat_pct, data.tax_pct, data.times_multiplier, data.job_quantity]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/cost-estimates/${estimate.id}`);
        else post('/cost-estimates');
    };

    const openWeightCalc = (idx: number) => {
        setWeightTargetIdx(idx);
        setWeightCalcOpen(true);
    };

    const onWeightApplied = (weight: number, materialName?: string) => {
        if (weightTargetIdx == null) return;
        const patch: Partial<Line> = { quantity: weight.toFixed(3) };
        if (materialName && !data.lines[weightTargetIdx].material_id) {
            const mat = materials.find((m: any) => m.name === materialName);
            if (mat) {
                patch.material_id = mat.id;
                patch.description = mat.name;
                patch.rate = String(mat.rate_per_kg);
                patch.unit = 'kg';
            }
        }
        updateLine(weightTargetIdx, patch);
    };

    return (
        <AppLayout header={isEdit ? `Cost Estimate ${estimate.estimate_no}` : 'New Cost Estimate'}>
            <div className="max-w-7xl animate-fade-in pb-32">
                <form onSubmit={submit} className="space-y-6">

                    {/* ── RFQ Item context banner (when creating from an RFQ item) ──── */}
                    {rfqItem && !isEdit && (
                        <div className="rounded-2xl p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                <i className="fi fi-rr-link text-base leading-none" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-0.5">Estimating for RFQ Item</div>
                                <div className="text-sm font-semibold text-surface-900">
                                    {rfqItem.job_description}
                                </div>
                                <div className="text-xs text-surface-600 mt-0.5 flex items-center gap-3 flex-wrap">
                                    <span>📦 Quantity: <span className="font-bold text-surface-800">{rfqItem.quantity} {rfqItem.unit}</span></span>
                                    <span>🏢 Customer: <span className="font-semibold text-surface-800">{rfqItem.customer_name || '—'}</span></span>
                                    <Link href={`/rfqs/${rfqItem.rfq_id}`} className="text-indigo-600 hover:text-indigo-800 font-semibold">
                                        View RFQ #{rfqItem.rfq_id} →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Show linked item on edit */}
                    {isEdit && estimate?.rfq_item && (
                        <div className="rounded-xl p-3 bg-indigo-50/70 border border-indigo-200 flex items-center gap-3 text-xs">
                            <i className="fi fi-rr-link text-indigo-500 text-sm leading-none" />
                            <span className="text-surface-700">
                                Linked to RFQ Item: <span className="font-bold text-surface-900">{estimate.rfq_item.job_description}</span>
                                {' · '}Qty: <span className="font-semibold">{estimate.rfq_item.quantity} {estimate.rfq_item.unit}</span>
                            </span>
                            {estimate.rfq_id && (
                                <Link href={`/rfqs/${estimate.rfq_id}`} className="ml-auto text-indigo-600 hover:text-indigo-800 font-semibold">
                                    View RFQ #{estimate.rfq_id} →
                                </Link>
                            )}
                        </div>
                    )}

                    {/* ── Header card ───────────────────────────────── */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
                                    <i className="fi fi-rr-calculator text-base leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-surface-900">Job Estimating / Costing</h2>
                                    <p className="text-xs text-surface-400">BITAC PCD — replicates the master Excel cost sheet</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* AI: Find Similar Job */}
                                <button type="button" onClick={findSimilarJob} disabled={similarLoading}
                                    title="AI finds a similar past estimate to pre-fill this form"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                                               bg-purple-50 text-purple-700 border border-purple-200
                                               hover:bg-purple-100 hover:border-purple-300
                                               disabled:opacity-50 transition-all">
                                    <i className={`fi ${similarLoading ? 'fi-rr-spinner animate-spin' : 'fi-rr-sparkles'} text-sm leading-none`} />
                                    {similarLoading ? 'Searching...' : 'Fill from Similar Job'}
                                </button>

                                {/* Pricing Group selector */}
                                <div className="flex flex-wrap items-center gap-1 bg-surface-100 p-1 rounded-xl">
                                    {PRICING_GROUPS.map(g => (
                                        <button key={g.value} type="button"
                                            onClick={() => onGroupChange(g.value)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                data.pricing_group === g.value
                                                    ? 'bg-white text-brand-700 shadow-premium'
                                                    : 'text-surface-500 hover:text-surface-700'
                                            }`}>
                                            {g.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* AI: Similar Job Match Banner */}
                        {(similarMatch || applyPhase !== 'idle') && (
                            <div className={`mx-5 mt-4 rounded-xl border animate-fade-in overflow-hidden transition-all duration-500 ${
                                applyPhase === 'done' ? 'bg-emerald-50 border-emerald-300' :
                                applyPhase !== 'idle' ? 'bg-purple-50 border-purple-300' :
                                'bg-purple-50 border-purple-200'
                            }`}>
                                {/* Progress bar overlay */}
                                {applyPhase !== 'idle' && applyPhase !== 'done' && (
                                    <div className="h-1 bg-purple-100 overflow-hidden">
                                        <div className={`h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700 ease-out ${
                                            applyPhase === 'analyzing' ? 'w-1/3' : 'w-2/3'
                                        }`} />
                                    </div>
                                )}
                                {applyPhase === 'done' && (
                                    <div className="h-1 bg-emerald-100">
                                        <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                                    </div>
                                )}

                                <div className="p-4">
                                    {/* Done state */}
                                    {applyPhase === 'done' ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                                <i className="fi fi-rr-check-circle text-emerald-600 text-xl leading-none" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-emerald-900">Form Updated Successfully!</h4>
                                                <p className="text-xs text-emerald-700 mt-0.5">
                                                    All line items filled with current rates. Review and adjust quantities as needed.
                                                </p>
                                            </div>
                                        </div>
                                    ) : applyPhase === 'analyzing' ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 animate-pulse">
                                                <i className="fi fi-rr-search text-purple-600 text-lg leading-none" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-purple-900">Analyzing estimate structure...</h4>
                                                <p className="text-xs text-purple-600 mt-0.5">Matching line items and recalculating rates for your pricing group</p>
                                            </div>
                                        </div>
                                    ) : applyPhase === 'applying' ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                                                <i className="fi fi-rr-sparkles text-purple-600 text-lg leading-none animate-spin" style={{ animationDuration: '2s' }} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-purple-900">Applying to form...</h4>
                                                <p className="text-xs text-purple-600 mt-0.5">Filling {similarMatch?.lines?.length ?? 0} line items with current catalog rates</p>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Default: show match details */
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                                                    <i className="fi fi-rr-sparkles text-purple-600 text-lg leading-none" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-purple-900">Similar Estimate Found</h4>
                                                    <p className="text-xs text-purple-700 mt-0.5">
                                                        <strong>{similarMatch?.estimate_no}</strong> — {similarMatch?.job_name}
                                                        {similarMatch?.company_name && ` · ${similarMatch.company_name}`}
                                                    </p>
                                                    <p className="text-xs text-purple-600 mt-1">
                                                        {similarMatch?.lines?.length} line items · Previous total: {Number(similarMatch?.grand_total ?? 0).toLocaleString('en-IN')} BDT
                                                    </p>
                                                    <p className="text-[10px] text-purple-500 mt-1">
                                                        ✅ Will copy: line items (current rates), overhead%, VAT%, sizes · 🔒 Keeps: your customer, job name, quantity, group
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button type="button" onClick={applyFromSimilar}
                                                    className="group relative px-4 py-2 rounded-xl text-xs font-bold text-white overflow-hidden
                                                               bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400
                                                               shadow-[0_4px_14px_-2px_rgba(147,51,234,0.5)] hover:shadow-[0_6px_20px_-2px_rgba(147,51,234,0.7)]
                                                               hover:-translate-y-0.5 active:scale-95 transition-all duration-200">
                                                    <span className="relative flex items-center gap-1.5">
                                                        <i className="fi fi-rr-sparkles text-sm leading-none group-hover:animate-spin" style={{ animationDuration: '3s' }} />
                                                        Apply to Form
                                                    </span>
                                                </button>
                                                <button type="button" onClick={() => setSimilarMatch(null)}
                                                    className="p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-100 transition-colors">
                                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Customer / Company</label>
                                    <SearchableSelect
                                        value={data.customer_id ?? ''}
                                        onChange={(v) => setData('customer_id', (v as any) || null)}
                                        options={(customers ?? []).map((c: any) => ({ value: c.id, label: c.name }))}
                                        placeholder="Search & select customer…"
                                    />
                                    {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Company Name <span className="form-label-optional">(or override)</span></label>
                                    <input type="text" value={data.company_name}
                                        onChange={e => setData('company_name', e.target.value)}
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Job Name *</label>
                                    <input type="text" value={data.job_name}
                                        onChange={e => setData('job_name', e.target.value)}
                                        placeholder="e.g. Mfg. of Spur Gear NT-21 & 16"
                                        className="form-input" required />
                                    {errors.job_name && <p className="form-error">{errors.job_name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Job / Part No</label>
                                    <input type="text" value={data.part_no}
                                        onChange={e => setData('part_no', e.target.value)}
                                        placeholder="e.g. 1/2"
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Actual Size <span className="form-label-optional">finished</span></label>
                                    <input type="text" value={data.actual_size}
                                        onChange={e => setData('actual_size', e.target.value)}
                                        placeholder="e.g. Ø80×120 mm"
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Materials Size <span className="form-label-optional">raw</span></label>
                                    <input type="text" value={data.materials_size}
                                        onChange={e => setData('materials_size', e.target.value)}
                                        placeholder="e.g. Ø85×130 mm"
                                        className="form-input" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── A. Material Cost ─────────────────────────── */}
                    <CostSection
                        title="A. Material Cost"
                        icon="fi-rr-cube"
                        color="blue"
                        total={totals.material}
                        onAdd={() => addLine('material')}
                    >
                        <table className="premium-table w-full" style={{ tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '3rem'  }} /> {/* # */}
                                <col style={{ width: '28%'   }} /> {/* Material — narrower */}
                                <col style={{ width: '15%'   }} /> {/* Qty */}
                                <col style={{ width: '11%'   }} /> {/* Unit */}
                                <col style={{ width: '15%'   }} /> {/* Rate */}
                                <col style={{ width: '15%'   }} /> {/* Amount */}
                                <col style={{ width: '2.5rem'}} /> {/* Delete */}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Material</th>
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>Rate (৳)</th>
                                    <th className="text-right">Amount (৳)</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.lines.map((line: Line, idx: number) => line.section !== 'material' ? null : (
                                    <tr key={idx}>
                                        <td className="text-surface-400 font-mono text-xs">{data.lines.filter((l: Line, i: number) => l.section === 'material' && i <= idx).length}</td>
                                        <td>
                                            <div className="space-y-1">
                                                <SearchableSelect
                                                    size="sm"
                                                    value={line.material_id ?? ''}
                                                    onChange={(v) => onMaterialChange(idx, String(v))}
                                                    options={materials.map((m: any) => ({ value: m.id, label: m.name }))}
                                                    placeholder="Select material…"
                                                />
                                                {!line.material_id && (
                                                    <input type="text" value={line.description}
                                                        onChange={e => updateLine(idx, { description: e.target.value })}
                                                        placeholder="Or describe..."
                                                        className="form-input text-xs py-1.5" />
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="0" step="0.001" value={line.quantity}
                                                    onChange={e => updateLine(idx, { quantity: e.target.value })}
                                                    className="form-input text-xs py-1.5" />
                                                <button type="button" onClick={() => openWeightCalc(idx)}
                                                    title="Open weight calculator"
                                                    className="btn-ghost btn-icon shrink-0 text-blue-600 hover:bg-blue-50">
                                                    <i className="fi fi-rr-scale text-xs leading-none" />
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <input type="text" value={line.unit}
                                                onChange={e => updateLine(idx, { unit: e.target.value })}
                                                className="form-input text-xs py-1.5" />
                                        </td>
                                        <td>
                                            <div className="relative">
                                                <input type="number" min="0" step="0.01" value={line.rate}
                                                    onChange={e => updateLine(idx, { rate: e.target.value })}
                                                    onFocus={() => { if (!rateSuggestions[idx] && (line.material_id || line.operation_id || line.description)) fetchRateSuggestion(idx, line); }}
                                                    className="form-input text-xs py-1.5 font-mono pr-7" />
                                                <button type="button" onClick={() => fetchRateSuggestion(idx, line)}
                                                    title="AI rate suggestion"
                                                    className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[9px] transition-colors ${
                                                        rateSuggestions[idx] ? 'text-purple-600 bg-purple-50' : 'text-surface-400 hover:text-purple-600 hover:bg-purple-50'
                                                    }`}>
                                                    {rateSugLoading === idx ? <i className="fi fi-rr-spinner animate-spin leading-none" /> : <i className="fi fi-rr-sparkles leading-none" />}
                                                </button>
                                                {rateSuggestions[idx] && (
                                                    <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl border border-purple-200 shadow-lg p-3 animate-fade-in">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">✨ Rate History</span>
                                                            <button type="button" onClick={() => setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; })} className="text-surface-400 hover:text-surface-600"><i className="fi fi-rr-cross-small text-xs leading-none" /></button>
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between"><span className="text-surface-500">Last used:</span><span className="font-mono font-bold">{rateSuggestions[idx].last_rate}</span></div>
                                                            <div className="flex justify-between"><span className="text-surface-500">Average:</span><span className="font-mono font-bold">{rateSuggestions[idx].avg_rate}</span></div>
                                                            <div className="flex justify-between"><span className="text-surface-500">Range:</span><span className="font-mono">{rateSuggestions[idx].min_rate} – {rateSuggestions[idx].max_rate}</span></div>
                                                            <div className="text-[9px] text-surface-400">{rateSuggestions[idx].sample_count} past estimates</div>
                                                        </div>
                                                        <div className="flex gap-1.5 mt-2 pt-2 border-t border-surface-100">
                                                            <button type="button" onClick={() => { updateLine(idx, { rate: String(rateSuggestions[idx].last_rate) }); setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; }); }}
                                                                className="flex-1 py-1 rounded-md text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100">
                                                                Use Last
                                                            </button>
                                                            <button type="button" onClick={() => { updateLine(idx, { rate: String(rateSuggestions[idx].avg_rate) }); setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; }); }}
                                                                className="flex-1 py-1 rounded-md text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100">
                                                                Use Avg
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right font-mono text-sm font-semibold text-surface-900">
                                            {fmt(lineAmount(line))}
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => removeLine(idx)}
                                                className="btn-ghost btn-icon text-red-500 hover:bg-red-50">
                                                <i className="fi fi-rr-cross-small text-xs leading-none" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <SubtotalFooter total={totals.material} />
                        </table>
                    </CostSection>

                    {/* ── B. Machining Cost ────────────────────────── */}
                    <CostSection
                        title="B. Machining Cost"
                        icon="fi-rr-settings"
                        color="amber"
                        total={totals.machining}
                        onAdd={() => addLine('machining')}
                    >
                        <OperationLines
                            lines={data.lines}
                            section="machining"
                            opsByCategory={opsByCategory}
                            onUpdate={updateLine}
                            onOperationChange={onOperationChange}
                            onRemove={removeLine}
                            lineAmount={lineAmount}
                            total={totals.machining}
                        />
                    </CostSection>

                    {/* ── C. Heat Treatment Cost ──────────────────── */}
                    <CostSection
                        title="C. Heat Treatment Cost"
                        icon="fi-rr-shine"
                        color="purple"
                        total={totals.surface}
                        onAdd={() => addLine('surface')}
                    >
                        <OperationLines
                            lines={data.lines}
                            section="surface"
                            opsByCategory={opsByCategory}
                            onUpdate={updateLine}
                            onOperationChange={onOperationChange}
                            onRemove={removeLine}
                            lineAmount={lineAmount}
                            total={totals.surface}
                        />
                    </CostSection>

                    {/* ── D. Other Parts ───────────────────────────── */}
                    <CostSection
                        title="D. Other Parts"
                        icon="fi-rr-box-alt"
                        color="green"
                        total={totals.other}
                        onAdd={() => addLine('other')}
                    >
                        <table className="premium-table w-full" style={{ tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '3rem'  }} /> {/* # */}
                                <col style={{ width: '28%'   }} /> {/* Description — narrower */}
                                <col style={{ width: '15%'   }} /> {/* Qty */}
                                <col style={{ width: '11%'   }} /> {/* Unit */}
                                <col style={{ width: '15%'   }} /> {/* TK / Pcs */}
                                <col style={{ width: '15%'   }} /> {/* Amount */}
                                <col style={{ width: '2.5rem'}} /> {/* Delete */}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Unit</th>
                                    <th>TK / Pcs</th>
                                    <th className="text-right">Amount (৳)</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.lines.map((line: Line, idx: number) => line.section !== 'other' ? null : (
                                    <tr key={idx}>
                                        <td className="text-surface-400 font-mono text-xs">{data.lines.filter((l: Line, i: number) => l.section === 'other' && i <= idx).length}</td>
                                        <td>
                                            <input type="text" value={line.description}
                                                onChange={e => updateLine(idx, { description: e.target.value })}
                                                placeholder="e.g. Hardware, fasteners..."
                                                className="form-input text-xs py-1.5" />
                                        </td>
                                        <td>
                                            <input type="number" min="0" step="0.001" value={line.quantity}
                                                onChange={e => updateLine(idx, { quantity: e.target.value })}
                                                className="form-input text-xs py-1.5" />
                                        </td>
                                        <td>
                                            <input type="text" value={line.unit}
                                                onChange={e => updateLine(idx, { unit: e.target.value })}
                                                className="form-input text-xs py-1.5" />
                                        </td>
                                        <td>
                                            <div className="relative">
                                                <input type="number" min="0" step="0.01" value={line.rate}
                                                    onChange={e => updateLine(idx, { rate: e.target.value })}
                                                    onFocus={() => { if (!rateSuggestions[idx] && (line.material_id || line.operation_id || line.description)) fetchRateSuggestion(idx, line); }}
                                                    className="form-input text-xs py-1.5 font-mono pr-7" />
                                                <button type="button" onClick={() => fetchRateSuggestion(idx, line)}
                                                    title="AI rate suggestion"
                                                    className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-[9px] transition-colors ${
                                                        rateSuggestions[idx] ? 'text-purple-600 bg-purple-50' : 'text-surface-400 hover:text-purple-600 hover:bg-purple-50'
                                                    }`}>
                                                    {rateSugLoading === idx ? <i className="fi fi-rr-spinner animate-spin leading-none" /> : <i className="fi fi-rr-sparkles leading-none" />}
                                                </button>
                                                {rateSuggestions[idx] && (
                                                    <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl border border-purple-200 shadow-lg p-3 animate-fade-in">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">✨ Rate History</span>
                                                            <button type="button" onClick={() => setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; })} className="text-surface-400 hover:text-surface-600"><i className="fi fi-rr-cross-small text-xs leading-none" /></button>
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between"><span className="text-surface-500">Last used:</span><span className="font-mono font-bold">{rateSuggestions[idx].last_rate}</span></div>
                                                            <div className="flex justify-between"><span className="text-surface-500">Average:</span><span className="font-mono font-bold">{rateSuggestions[idx].avg_rate}</span></div>
                                                            <div className="flex justify-between"><span className="text-surface-500">Range:</span><span className="font-mono">{rateSuggestions[idx].min_rate} – {rateSuggestions[idx].max_rate}</span></div>
                                                            <div className="text-[9px] text-surface-400">{rateSuggestions[idx].sample_count} past estimates</div>
                                                        </div>
                                                        <div className="flex gap-1.5 mt-2 pt-2 border-t border-surface-100">
                                                            <button type="button" onClick={() => { updateLine(idx, { rate: String(rateSuggestions[idx].last_rate) }); setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; }); }}
                                                                className="flex-1 py-1 rounded-md text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100">
                                                                Use Last
                                                            </button>
                                                            <button type="button" onClick={() => { updateLine(idx, { rate: String(rateSuggestions[idx].avg_rate) }); setRateSuggestions(p => { const n = {...p}; delete n[idx]; return n; }); }}
                                                                className="flex-1 py-1 rounded-md text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100">
                                                                Use Avg
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right font-mono text-sm font-semibold text-surface-900">
                                            {fmt(lineAmount(line))}
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => removeLine(idx)}
                                                className="btn-ghost btn-icon text-red-500 hover:bg-red-50">
                                                <i className="fi fi-rr-cross-small text-xs leading-none" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <SubtotalFooter total={totals.other} />
                        </table>
                    </CostSection>

                    {/* ── Totals card ──────────────────────────────── */}
                    <div className="card border-2 border-brand-200">
                        <div className="card-header bg-brand-50/50">
                            <h3 className="text-sm font-bold text-surface-900">Cost Summary</h3>
                        </div>
                        <div className="card-body space-y-2">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Subtotals */}
                                <div className="space-y-2 text-sm">
                                    <SumRow label="A. Material Cost"          value={totals.material} />
                                    <SumRow label="B. Machining Cost"          value={totals.machining} />
                                    <SumRow label="C. Heat Treatment Cost"    value={totals.surface} />
                                    <SumRow label="D. Other Parts"             value={totals.other} />
                                    <div className="border-t-2 border-dashed border-surface-200 pt-2">
                                        <SumRow label="E. Net Cost (A+B+C+D)" value={totals.net} bold />
                                    </div>
                                </div>

                                {/* Multipliers + Grand Total */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="form-group">
                                            <label className="form-label text-xs">F. Overhead %</label>
                                            <input type="number" min="0" step="0.01" value={data.overhead_pct}
                                                onChange={e => setData('overhead_pct', e.target.value)}
                                                className="form-input text-xs py-1.5" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label text-xs">G. VAT %</label>
                                            <input type="number" min="0" step="0.01" value={data.vat_pct}
                                                onChange={e => setData('vat_pct', e.target.value)}
                                                className="form-input text-xs py-1.5" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label text-xs">Tax % <span className="form-label-optional">e.g. AIT</span></label>
                                            <input type="number" min="0" step="0.01" value={data.tax_pct}
                                                onChange={e => setData('tax_pct', e.target.value)}
                                                className="form-input text-xs py-1.5" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label text-xs">H. Times (×) <span className="form-label-optional">precision</span></label>
                                            <input type="number" min="0" step="0.01" value={data.times_multiplier}
                                                onChange={e => setData('times_multiplier', e.target.value)}
                                                className="form-input text-xs py-1.5" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label text-xs">Job Quantity</label>
                                            <input type="number" min="1" value={data.job_quantity}
                                                onChange={e => setData('job_quantity', e.target.value)}
                                                className="form-input text-xs py-1.5" />
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-gradient-to-br from-surface-900 to-surface-800 p-4 text-white">
                                        <div className="flex items-center justify-between text-xs mb-1 text-white/60">
                                            <span>Overhead Amount</span>
                                            <span className="font-mono">{fmt(totals.overhead)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs mb-1 text-white/60">
                                            <span>VAT Amount</span>
                                            <span className="font-mono">{fmt(totals.vat)}</span>
                                        </div>
                                        {totals.tax > 0 && (
                                            <div className="flex items-center justify-between text-xs mb-1 text-white/60">
                                                <span>Tax Amount</span>
                                                <span className="font-mono">{fmt(totals.tax)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-sm pt-2 mt-2 border-t border-white/10">
                                            <span>I. Total (per piece × times)</span>
                                            <span className="font-mono font-semibold">{fmt(totals.total)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-base pt-2 mt-2 border-t border-white/20">
                                            <span className="font-bold">J. Grand Total</span>
                                            <span className="font-mono font-bold text-2xl text-brand-400">{fmt(totals.grand)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes + Submit */}
                    <div className="card">
                        <div className="card-body space-y-4">
                            <div className="form-group">
                                <label className="form-label">Notes <span className="form-label-optional">internal</span></label>
                                <textarea value={data.notes ?? ''}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={2} className="form-textarea" />
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="submit" disabled={processing} className="btn-primary">
                                    {processing ? (
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                                    ) : (
                                        <><i className="fi fi-rr-check text-sm leading-none" /> {isEdit ? 'Update' : 'Save'} Estimate</>
                                    )}
                                </button>
                                <Link href="/cost-estimates" className="btn-outline">Cancel</Link>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Weight Calculator Modal */}
            <WeightCalculator
                open={weightCalcOpen}
                onClose={() => setWeightCalcOpen(false)}
                onApply={onWeightApplied}
                materials={materials}
            />
        </AppLayout>
    );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function CostSection({ title, icon, color, total, onAdd, children }: any) {
    const colors: Record<string, string> = {
        blue:   'bg-blue-50 text-blue-600',
        amber:  'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
        green:  'bg-emerald-50 text-emerald-600',
    };
    return (
        <div className="card">
            <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors[color]}`}>
                        <i className={`fi ${icon} text-sm leading-none`} />
                    </div>
                    <h3 className="text-sm font-bold text-surface-900">{title}</h3>
                </div>
                <button type="button" onClick={onAdd} className="btn-outline btn-xs">
                    <i className="fi fi-rr-plus text-xs leading-none" /> Add Row
                </button>
            </div>
            <div className="card-body p-0 overflow-x-auto">
                {children}
            </div>
        </div>
    );
}

/** Reusable subtotal footer row — matches the 7-column layout used by both
 *  Material and Operation tables (# · main · qty · unit · rate · amount · ×). */
function SubtotalFooter({ total }: { total: number }) {
    return (
        <tfoot>
            <tr className="border-t-2 border-surface-200 bg-surface-50/60">
                <td colSpan={5} className="px-3 py-3 text-right">
                    <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">Subtotal</span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-base font-bold text-surface-900">
                    ৳{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td></td>
            </tr>
        </tfoot>
    );
}

function OperationLines({ lines, section, opsByCategory, onUpdate, onOperationChange, onRemove, lineAmount, total }: any) {
    return (
        <table className="premium-table w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
                <col style={{ width: '3rem'  }} /> {/* # */}
                <col style={{ width: '28%'   }} /> {/* Operation — narrower */}
                <col style={{ width: '15%'   }} /> {/* Qty / Hours */}
                <col style={{ width: '11%'   }} /> {/* Unit */}
                <col style={{ width: '15%'   }} /> {/* Rate */}
                <col style={{ width: '15%'   }} /> {/* Sub-Total */}
                <col style={{ width: '2.5rem'}} /> {/* Delete */}
            </colgroup>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Operation</th>
                    <th>Qty / Hours</th>
                    <th>Unit</th>
                    <th>Rate (৳)</th>
                    <th className="text-right">Sub-Total (৳)</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {lines.map((line: Line, idx: number) => line.section !== section ? null : (
                    <tr key={idx}>
                        <td className="text-surface-400 font-mono text-xs">{lines.filter((l: Line, i: number) => l.section === section && i <= idx).length}</td>
                        <td>
                            <SearchableSelect
                                size="sm"
                                value={line.operation_id ?? ''}
                                onChange={(v) => onOperationChange(idx, String(v))}
                                options={Object.entries(opsByCategory).flatMap(([cat, ops]: any) =>
                                    ops.map((o: any) => ({
                                        value: o.id,
                                        label: o.name,
                                        sublabel: cat.replace(/_/g, ' '),
                                    }))
                                )}
                                placeholder="Select operation…"
                            />
                            {!line.operation_id && (
                                <input type="text" value={line.description}
                                    onChange={e => onUpdate(idx, { description: e.target.value })}
                                    placeholder="Or describe..."
                                    className="form-input text-xs py-1.5 mt-1" />
                            )}
                        </td>
                        <td>
                            <input type="number" min="0" step="0.001" value={line.quantity}
                                onChange={e => onUpdate(idx, { quantity: e.target.value })}
                                className="form-input text-xs py-1.5" />
                        </td>
                        <td>
                            <input type="text" value={line.unit}
                                onChange={e => onUpdate(idx, { unit: e.target.value })}
                                className="form-input text-xs py-1.5" />
                        </td>
                        <td>
                            <input type="number" min="0" step="0.01" value={line.rate}
                                onChange={e => onUpdate(idx, { rate: e.target.value })}
                                className="form-input text-xs py-1.5 font-mono" />
                        </td>
                        <td className="text-right font-mono text-sm font-semibold text-surface-900">
                            {`৳${lineAmount(line).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </td>
                        <td>
                            <button type="button" onClick={() => onRemove(idx)}
                                className="btn-ghost btn-icon text-red-500 hover:bg-red-50">
                                <i className="fi fi-rr-cross-small text-xs leading-none" />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
            <SubtotalFooter total={total ?? 0} />
        </table>
    );
}

function SumRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
    return (
        <div className={`flex items-center justify-between py-1.5 ${bold ? 'text-base font-bold text-surface-900' : 'text-surface-600'}`}>
            <span>{label}</span>
            <span className="font-mono">{`৳${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
        </div>
    );
}
