import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';
import WeightCalculator from '@/Components/Widgets/WeightCalculator';
import UnitSelect from '@/Components/UnitSelect';

interface RequisitionItem {
    material_id: number | null;
    item_name: string;
    description: string;
    unit: string;
    required_qty: number | string;
    remarks: string;
}

interface MaterialOption {
    id: number;
    name: string;
    category?: string | null;
    unit?: string | null;
    density_kg_m3: number;
}

interface WorkOrderOption {
    id: number;
    wo_number: string;
    job_number?: string | null;
    customer?: string | null;
}

interface WorkOrderFull extends WorkOrderOption {
    rfq_items?: { description: string; quantity: number | string; unit: string }[];
}

interface Props {
    requisition?: any | null;
    work_order?: WorkOrderFull | null;
    work_orders: WorkOrderOption[];
    materials: MaterialOption[];
    prefilled_items?: any[];
    next_mrn?: string;
    shops?: { id: number; name: string }[];
    demand?: { id: number; demand_no: string; section_id?: number; shop?: string | null; requested_by?: string | null; needed_by?: string | null; notes?: string | null } | null;
}

const emptyItem = (): RequisitionItem => ({ material_id: null, item_name: '', description: '', unit: 'kg', required_qty: '', remarks: '' });

/**
 * Raise (or edit) a material requisition. No IMS: the form saves the lines and
 * the requisition goes to the store as a status — Save Draft, or Save & Submit.
 * Materials are picked the way a cost estimate picks them (searchable master),
 * and the weight calculator works out the kilos and writes the size.
 */
export default function MaterialRequisitionForm({ requisition, work_order, work_orders, materials, prefilled_items = [], next_mrn, demand = null, shops = [] }: Props) {
    const isEdit = !!requisition?.id;
    const isDraft = !isEdit || requisition.status === 'draft';

    const initialItems: RequisitionItem[] = isEdit && requisition.items?.length
        ? requisition.items.map((i: any) => ({
            material_id: i.material_id, item_name: i.item_name ?? '', description: i.description ?? '', unit: i.unit ?? 'kg',
            required_qty: i.required_qty ?? '', remarks: i.remarks ?? '',
        }))
        : prefilled_items.length
            ? prefilled_items.map((p: any) => ({
                material_id: p.material_id, item_name: p.item_name ?? '', description: p.description ?? '', unit: p.unit ?? 'kg',
                required_qty: p.required_qty ?? '', remarks: p.remarks ?? '',
            }))
            : [emptyItem()];

    const submitRef = useRef(false);
    const { data, setData, post, put, processing, errors, transform } = useForm({
        mrn_number: requisition?.mrn_number ?? '',
        demand_id: demand?.id ?? '',
        work_order_id: requisition?.work_order_id ?? work_order?.id ?? '',
        section_id: requisition?.section_id ?? demand?.section_id ?? '',
        request_date: requisition?.request_date ?? new Date().toISOString().slice(0, 10),
        notes: requisition?.notes ?? '',
        items: initialItems,
    });
    transform((d) => ({ ...d, submit: submitRef.current ? 1 : 0 }));

    const [calcFor, setCalcFor] = useState<number | null>(null);

    const selectedWorkOrder = useMemo<WorkOrderFull | WorkOrderOption | null>(() => {
        if (work_order && String(work_order.id) === String(data.work_order_id)) return work_order;
        return work_orders.find((w) => String(w.id) === String(data.work_order_id)) ?? null;
    }, [work_order, work_orders, data.work_order_id]);

    const rfqItems = (selectedWorkOrder as WorkOrderFull | null)?.rfq_items ?? [];
    const estimateSources = useMemo(
        () => Array.from(new Set(prefilled_items.map((p: any) => (p.remarks ?? '').replace(/^From\s+/, '')).filter(Boolean))),
        [prefilled_items],
    );
    const materialOptions = useMemo(
        () => materials.map((m) => ({ value: m.id, label: m.name, sublabel: m.category ?? undefined })),
        [materials],
    );

    const err = (k: string) => (errors as Record<string, string>)[k];

    const updateItem = (index: number, patch: Partial<RequisitionItem>) =>
        setData('items', data.items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

    const onMaterialChange = (index: number, value: string | number | '') => {
        const id = value === '' ? null : Number(value);
        const mat = materials.find((m) => m.id === id);
        // The unit follows how that material is bought; the spec stays the preparer's.
        updateItem(index, { material_id: id, ...(id ? { item_name: '' } : {}), ...(mat?.unit ? { unit: mat.unit } : {}) });
    };

    const addRow = () => setData('items', [...data.items, emptyItem()]);
    const removeRow = (index: number) => {
        if (data.items.length <= 1) return;
        setData('items', data.items.filter((_, i) => i !== index));
    };

    /** The calculator gives the total kilos for the pieces and says what to cut. */
    const onWeightApplied = (weight: number, materialName?: string, spec?: string) => {
        if (calcFor == null) return;
        const it = data.items[calcFor];
        const patch: Partial<RequisitionItem> = { required_qty: weight.toFixed(3), unit: 'kg' };
        if (!it.material_id && materialName) {
            const mat = materials.find((m) => m.name === materialName);
            if (mat) patch.material_id = mat.id;
        }
        if (spec) {
            const current = it.description.trim();
            patch.description = !current ? spec : (current.includes(spec) ? current : `${current}\n${spec}`);
        }
        updateItem(calcFor, patch);
    };

    const save = (e: FormEvent, andSubmit: boolean) => {
        e.preventDefault();
        submitRef.current = andSubmit;
        if (isEdit) put(`/pcd/material-requisitions/${requisition.id}`);
        else post('/pcd/material-requisitions');
    };

    return (
        <AppLayout header={isEdit ? `Edit ${requisition.mrn_number}` : 'New Material Requisition'}>
            <form onSubmit={(e) => save(e, false)} className="space-y-6 animate-fade-in">
                {/* Header + job */}
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Material Requisition Note</h2>
                            <p className="text-xs text-surface-500 mt-0.5">
                                What the job needs from the store. It goes to the store as a status — there is no IMS push.
                            </p>
                        </div>
                        {isEdit && <span className="badge badge-slate shrink-0">{requisition.status_label}</span>}
                    </div>
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="form-group">
                                <label className="form-label">MRN No. <span className="form-label-optional">from IMS</span></label>
                                <input type="text" value={data.mrn_number} maxLength={30}
                                    onChange={(e) => setData('mrn_number', e.target.value)}
                                    className="form-input font-mono"
                                    placeholder={isEdit ? '' : `Blank → ${next_mrn ?? 'auto-numbered'}`} />
                                <p className="form-hint">The number IMS gave it. Can also be added later, on the requisition.</p>
                                {err('mrn_number') && <div className="form-error">{err('mrn_number')}</div>}
                            </div>
                            <div className="form-group md:col-span-2">
                                <label className="form-label">Job <span className="form-label-optional">optional</span></label>
                                {work_order || isEdit || demand ? (
                                    <div className="form-input bg-surface-50 cursor-not-allowed truncate">
                                        {selectedWorkOrder ? (
                                            <>
                                                <span className="font-mono font-semibold text-brand-600">{selectedWorkOrder.wo_number}</span>
                                                {selectedWorkOrder.customer && <span className="text-surface-500"> — {selectedWorkOrder.customer}</span>}
                                            </>
                                        ) : <span className="text-surface-500">No job — shop use</span>}
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        value={data.work_order_id}
                                        onChange={(v) => setData('work_order_id', v)}
                                        options={work_orders.map((w) => ({
                                            value: w.id,
                                            label: `${w.wo_number}${w.job_number ? ` · Job ${w.job_number}` : ''}`,
                                            sublabel: w.customer ?? undefined,
                                        }))}
                                        placeholder="No job — consumables, tools, shop use"
                                    />
                                )}
                                {err('work_order_id') && <div className="form-error">{err('work_order_id')}</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Request date</label>
                                <input type="date" value={data.request_date}
                                    onChange={(e) => setData('request_date', e.target.value)} className="form-input" />
                                {err('request_date') && <div className="form-error">{err('request_date')}</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    For shop {data.work_order_id ? <span className="form-label-optional">optional</span> : <span className="text-red-500">*</span>}
                                </label>
                                {demand ? (
                                    <div className="form-input bg-surface-50 cursor-not-allowed truncate">{demand.shop}</div>
                                ) : (
                                    <select value={data.section_id} onChange={(e) => setData('section_id', e.target.value ? Number(e.target.value) : '')} className="form-select">
                                        <option value="">{data.work_order_id ? '—' : 'Select shop…'}</option>
                                        {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                )}
                                {!data.work_order_id && <p className="form-hint">No job picked — say whose material it is.</p>}
                                {err('section_id') && <div className="form-error">{err('section_id')}</div>}
                            </div>
                        </div>

                        {rfqItems.length > 0 && (
                            <div className="rounded-lg border border-surface-100 bg-surface-50/60 p-3">
                                <div className="text-[11px] font-semibold uppercase text-surface-500 mb-2">
                                    {selectedWorkOrder?.job_number ? `Job ${selectedWorkOrder.job_number} — ` : ''}what was ordered
                                </div>
                                <ul className="space-y-1 text-xs text-surface-700">
                                    {rfqItems.map((ri, i) => (
                                        <li key={i} className="flex justify-between gap-2">
                                            <span className="min-w-0 truncate">{ri.description}</span>
                                            <span className="font-mono text-surface-500 shrink-0">{ri.quantity} {ri.unit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lines */}
                <div className="card">
                    <div className="card-header flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Materials</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Pick from the materials master. <i className="fi fi-rr-scale text-[10px]" /> works out the weight from the size.
                            </p>
                        </div>
                        <button type="button" onClick={addRow} className="btn-outline btn-sm shrink-0">
                            <i className="fi fi-rr-plus text-xs leading-none" /> Add line
                        </button>
                    </div>

                    {demand && (
                        <div className="px-5 py-3 bg-sky-50 border-b border-sky-100 flex items-start gap-2.5">
                            <i className="fi fi-rr-boxes text-sky-600 text-sm leading-none mt-0.5" />
                            <div className="min-w-0 text-xs">
                                <p className="font-bold text-sky-900">
                                    Answering {demand.demand_no} from {demand.shop}{demand.requested_by ? ` (${demand.requested_by})` : ''}
                                    {demand.needed_by ? ` — needed by ${demand.needed_by}` : ''}
                                </p>
                                <p className="text-sky-800/80 mt-0.5">
                                    The lines are what the shop asked for. Saving links this requisition to the demand and tells the shop.
                                    {demand.notes ? ` Shop's note: “${demand.notes}”` : ''}
                                </p>
                            </div>
                        </div>
                    )}
                    {!isEdit && !demand && estimateSources.length > 0 && (
                        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-start gap-2.5">
                            <i className="fi fi-rr-check-circle text-emerald-600 text-sm leading-none mt-0.5" />
                            <div className="min-w-0 text-xs">
                                <p className="font-bold text-emerald-900">Filled in from the costing: {estimateSources.join(', ')}</p>
                                <p className="text-emerald-800/80 mt-0.5">
                                    Each estimate's material, for the whole quantity it costed. Check the sizes and adjust before saving.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table min-w-[900px]">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th className="w-[26%]">Material / item <span className="text-red-500">*</span></th>
                                    <th>Size / spec <span className="font-normal text-surface-400">— what to cut</span></th>
                                    <th className="w-44">Required <span className="text-red-500">*</span></th>
                                    <th className="w-28">Unit</th>
                                    <th className="w-[18%]">Remarks</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((it, index) => (
                                    <tr key={index} className="align-top">
                                        <td className="pt-4 text-center font-semibold text-surface-500 text-xs">{index + 1}</td>
                                        <td>
                                            <SearchableSelect
                                                size="sm"
                                                value={it.material_id ?? ''}
                                                onChange={(v) => onMaterialChange(index, v)}
                                                options={materialOptions}
                                                placeholder="Select material…"
                                            />
                                            {!it.material_id && (
                                                <input type="text" value={it.item_name} maxLength={255}
                                                    onChange={(e) => updateItem(index, { item_name: e.target.value })}
                                                    className="form-input text-xs py-1.5 mt-1" placeholder="Or type any item — e.g. Cotton gloves" />
                                            )}
                                            {err(`items.${index}.material_id`) && <div className="form-error">{err(`items.${index}.material_id`)}</div>}
                                            {err(`items.${index}.item_name`) && <div className="form-error">{err(`items.${index}.item_name`)}</div>}
                                        </td>
                                        <td>
                                            <textarea
                                                value={it.description}
                                                onChange={(e) => updateItem(index, { description: e.target.value })}
                                                rows={2}
                                                className="form-textarea text-sm min-h-[44px]"
                                                style={{ resize: 'vertical' }}
                                                placeholder={'e.g. Round Bar Ø50 × 200 mm, 10 pcs'}
                                            />
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="0" step="0.001" value={it.required_qty}
                                                    onChange={(e) => updateItem(index, { required_qty: e.target.value })}
                                                    className="form-input text-sm py-1.5 text-right font-mono !px-2" placeholder="0" />
                                                <button type="button" onClick={() => setCalcFor(index)}
                                                    title="Weight calculator — work out the kilos from the size"
                                                    className="btn-ghost btn-icon shrink-0 text-blue-600 hover:bg-blue-50">
                                                    <i className="fi fi-rr-scale text-xs leading-none" />
                                                </button>
                                            </div>
                                            {err(`items.${index}.required_qty`) && <div className="form-error">{err(`items.${index}.required_qty`)}</div>}
                                        </td>
                                        <td>
                                            <UnitSelect value={it.unit} onChange={(u) => updateItem(index, { unit: u })} />
                                        </td>
                                        <td>
                                            <input type="text" value={it.remarks}
                                                onChange={(e) => updateItem(index, { remarks: e.target.value })}
                                                className="form-input text-sm py-1.5" />
                                        </td>
                                        <td className="pt-3 text-center">
                                            <button type="button" onClick={() => removeRow(index)} disabled={data.items.length <= 1}
                                                className="btn-ghost btn-xs text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Remove line">
                                                <i className="fi fi-rr-trash text-xs leading-none" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {err('items') && <div className="form-error px-5 pb-3">{err('items')}</div>}
                    </div>
                </div>

                {/* Notes */}
                <div className="card">
                    <div className="card-body">
                        <label className="form-label">Notes <span className="form-label-optional">optional</span></label>
                        <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)}
                            className="form-textarea" rows={3} placeholder="Anything the store should know…" />
                        {err('notes') && <div className="form-error">{err('notes')}</div>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href={isEdit ? `/pcd/material-requisitions/${requisition.id}` : '/pcd/material-requisitions'} className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" /> {isEdit ? 'Back to requisition' : 'Back to list'}
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={(e) => save(e, false)} disabled={processing} className="btn-outline btn-sm">
                            <i className="fi fi-rr-disk text-xs leading-none" /> {isDraft ? 'Save draft' : 'Save changes'}
                        </button>
                        {isDraft && (
                            <button type="button" onClick={(e) => save(e, true)} disabled={processing} className="btn-primary btn-sm">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" /> Save &amp; submit to store
                            </button>
                        )}
                    </div>
                </div>
            </form>

            <WeightCalculator
                open={calcFor !== null}
                onClose={() => setCalcFor(null)}
                onApply={onWeightApplied}
                materials={materials.map((m) => ({ id: m.id, name: m.name, density_kg_m3: Number(m.density_kg_m3) || 0 }))}
                initialMaterialId={calcFor !== null ? data.items[calcFor]?.material_id : null}
            />
        </AppLayout>
    );
}
