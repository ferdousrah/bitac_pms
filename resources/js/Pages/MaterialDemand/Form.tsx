import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';
import WeightCalculator from '@/Components/Widgets/WeightCalculator';

interface Line { material_id: number | null; description: string; unit: string; quantity: number | string; remarks: string }
interface Job { section_id: number; id: number; wo_number: string; job_number?: string | null; customer?: string | null; leg_status: string }
interface MaterialOption { id: number; name: string; category?: string | null; unit?: string | null; density_kg_m3: number }

interface Props {
    demand: any | null;
    presets: { section_id?: number | null; work_order_id?: number | null };
    shops: { id: number; name: string; code?: string }[];
    jobs: Job[];
    materials: MaterialOption[];
}

const emptyLine = (): Line => ({ material_id: null, description: '', unit: 'kg', quantity: '', remarks: '' });

/**
 * A shop asks PCD for material for one of its jobs. Materials come from the
 * master and the weight calculator works out the kilos (and writes the size),
 * exactly as on PCD's requisition — so what PCD receives reads the same way.
 */
export default function MaterialDemandForm({ demand, presets, shops, jobs, materials }: Props) {
    const isEdit = !!demand?.id;
    const firstShop = demand?.section_id ?? presets.section_id ?? (shops.length === 1 ? shops[0].id : '');

    const { data, setData, post, put, processing, errors } = useForm({
        section_id: firstShop as number | '',
        work_order_id: (demand?.work_order_id ?? presets.work_order_id ?? '') as number | '',
        needed_by: demand?.needed_by ?? '',
        notes: demand?.notes ?? '',
        items: (demand?.items?.length ? demand.items : [emptyLine()]) as Line[],
    });
    const [calcFor, setCalcFor] = useState<number | null>(null);
    const err = (k: string) => (errors as Record<string, string>)[k];

    const shopJobs = useMemo(() => jobs.filter((j) => j.section_id === Number(data.section_id)), [jobs, data.section_id]);
    const materialOptions = useMemo(
        () => materials.map((m) => ({ value: m.id, label: m.name, sublabel: m.category ?? undefined })), [materials]);

    const updateLine = (i: number, patch: Partial<Line>) =>
        setData('items', data.items.map((l, j) => (j === i ? { ...l, ...patch } : l)));

    const pickMaterial = (i: number, v: string | number | '') => {
        const id = v === '' ? null : Number(v);
        const mat = materials.find((m) => m.id === id);
        updateLine(i, { material_id: id, ...(mat?.unit ? { unit: mat.unit } : {}) });
    };

    const onWeight = (weight: number, materialName?: string, spec?: string) => {
        if (calcFor == null) return;
        const l = data.items[calcFor];
        const patch: Partial<Line> = { quantity: weight.toFixed(3), unit: 'kg' };
        if (!l.material_id && materialName) {
            const mat = materials.find((m) => m.name === materialName);
            if (mat) patch.material_id = mat.id;
        }
        if (spec) {
            const cur = l.description.trim();
            patch.description = !cur ? spec : (cur.includes(spec) ? cur : `${cur}\n${spec}`);
        }
        updateLine(calcFor, patch);
    };

    const save = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/material-demands/${demand.id}`);
        else post('/material-demands');
    };

    return (
        <AppLayout header={isEdit ? `Edit ${demand.demand_no}` : 'Material Demand'}>
            <form onSubmit={save} className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">{isEdit ? demand.demand_no : 'Ask PCD for material'}</h2>
                        <p className="text-xs text-surface-500 mt-0.5">
                            Say what the job needs. PCD raises the requisition to the store from it — you will see its progress here.
                        </p>
                    </div>
                    <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="form-group">
                            <label className="form-label">Shop</label>
                            {shops.length === 1 ? (
                                <div className="form-input bg-surface-50 cursor-not-allowed">{shops[0].name}</div>
                            ) : (
                                <select value={data.section_id} className="form-select"
                                    onChange={(e) => setData((d) => ({ ...d, section_id: e.target.value ? Number(e.target.value) : '', work_order_id: '' }))}>
                                    <option value="">Select shop…</option>
                                    {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}
                            {err('section_id') && <div className="form-error">{err('section_id')}</div>}
                        </div>
                        <div className="form-group md:col-span-2">
                            <label className="form-label">Job</label>
                            <SearchableSelect
                                value={data.work_order_id}
                                onChange={(v) => setData('work_order_id', v === '' ? '' : Number(v))}
                                options={shopJobs.map((j) => ({
                                    value: j.id,
                                    label: `${j.job_number ? `Job ${j.job_number} · ` : ''}${j.wo_number}`,
                                    sublabel: j.customer ?? undefined,
                                }))}
                                placeholder={data.section_id ? (shopJobs.length ? 'Select the job…' : 'No open jobs at this shop') : 'Pick the shop first'}
                                disabled={!data.section_id}
                            />
                            {err('work_order_id') && <div className="form-error">{err('work_order_id')}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Needed by <span className="form-label-optional">optional</span></label>
                            <input type="date" value={data.needed_by} onChange={(e) => setData('needed_by', e.target.value)} className="form-input" />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Material needed</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Pick from the materials master. <i className="fi fi-rr-scale text-[10px]" /> works out the weight from the size.
                            </p>
                        </div>
                        <button type="button" onClick={() => setData('items', [...data.items, emptyLine()])} className="btn-outline btn-sm shrink-0">
                            <i className="fi fi-rr-plus text-xs leading-none" /> Add line
                        </button>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table min-w-[900px]">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th className="w-[26%]">Material <span className="text-red-500">*</span></th>
                                    <th>Size / spec</th>
                                    <th className="w-44">Quantity <span className="text-red-500">*</span></th>
                                    <th className="w-24">Unit</th>
                                    <th className="w-[18%]">Why / remarks</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((l, i) => (
                                    <tr key={i} className="align-top">
                                        <td className="pt-4 text-center text-xs font-semibold text-surface-500">{i + 1}</td>
                                        <td>
                                            <SearchableSelect size="sm" value={l.material_id ?? ''} onChange={(v) => pickMaterial(i, v)}
                                                options={materialOptions} placeholder="Select material…" />
                                            {err(`items.${i}.material_id`) && <div className="form-error">{err(`items.${i}.material_id`)}</div>}
                                        </td>
                                        <td>
                                            <textarea value={l.description} rows={2} style={{ resize: 'vertical' }}
                                                onChange={(e) => updateLine(i, { description: e.target.value })}
                                                className="form-textarea text-sm min-h-[44px]" placeholder="e.g. Round Bar Ø50 × 200 mm, 10 pcs" />
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="0" step="0.001" value={l.quantity}
                                                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                                                    className="form-input text-sm py-1.5 text-right font-mono !px-2" placeholder="0" />
                                                <button type="button" onClick={() => setCalcFor(i)} title="Weight calculator — work out the kilos from the size"
                                                    className="btn-ghost btn-icon shrink-0 text-blue-600 hover:bg-blue-50">
                                                    <i className="fi fi-rr-scale text-xs leading-none" />
                                                </button>
                                            </div>
                                            {err(`items.${i}.quantity`) && <div className="form-error">{err(`items.${i}.quantity`)}</div>}
                                        </td>
                                        <td>
                                            <input type="text" value={l.unit} list="md-units" onChange={(e) => updateLine(i, { unit: e.target.value })}
                                                className="form-input text-sm py-1.5 text-center !px-2" />
                                        </td>
                                        <td>
                                            <input type="text" value={l.remarks} onChange={(e) => updateLine(i, { remarks: e.target.value })}
                                                className="form-input text-sm py-1.5" />
                                        </td>
                                        <td className="pt-3 text-center">
                                            <button type="button" disabled={data.items.length <= 1}
                                                onClick={() => setData('items', data.items.filter((_, j) => j !== i))}
                                                className="btn-ghost btn-xs text-red-600 disabled:opacity-30" title="Remove line">
                                                <i className="fi fi-rr-trash text-xs leading-none" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <datalist id="md-units">{['kg', 'pcs', 'm', 'ft', 'sheet', 'set', 'L'].map((u) => <option key={u} value={u} />)}</datalist>
                        {err('items') && <div className="form-error px-5 pb-3">{err('items')}</div>}
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <label className="form-label">Note to PCD <span className="form-label-optional">optional</span></label>
                        <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} className="form-textarea" rows={3}
                            placeholder="Anything PCD should know — e.g. which operation it is for, or what to use if this is not in stock…" />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href={isEdit ? `/material-demands/${demand.id}` : '/material-demands'} className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                    </Link>
                    <button type="submit" disabled={processing} className="btn-primary btn-sm">
                        <i className="fi fi-rr-paper-plane text-xs leading-none" /> {isEdit ? 'Save changes' : 'Send to PCD'}
                    </button>
                </div>
            </form>

            <WeightCalculator
                open={calcFor !== null}
                onClose={() => setCalcFor(null)}
                onApply={onWeight}
                materials={materials.map((m) => ({ id: m.id, name: m.name, density_kg_m3: Number(m.density_kg_m3) || 0 }))}
                initialMaterialId={calcFor !== null ? data.items[calcFor]?.material_id : null}
            />
        </AppLayout>
    );
}
