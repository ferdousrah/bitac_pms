import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';

interface RfqItem {
    description: string;
    quantity: number | string;
    unit: string;
}

interface WorkOrderFull {
    id: number;
    wo_number: string;
    job_number?: string;
    customer?: string;
    rfq_items?: RfqItem[];
}

interface WorkOrderOption {
    id: number;
    wo_number: string;
    job_number?: string;
    customer?: string;
}

interface MaterialOption {
    id: number;
    name: string;
    unit?: string | null;
    rate_per_kg?: number;
}

interface RequisitionItem {
    item_no: number;
    description: string;
    material_id: number | null;
    unit: string;
    required_qty: number | string;
    stock_qty: number | string;
    issue_qty: number | string;
    issue_date: string;
    remarks: string;
}

interface RequisitionData {
    id?: number;
    mrn_number?: string;
    work_order_id: number | string;
    request_date: string;
    status: string;
    notes: string;
    items: RequisitionItem[];
}

interface Props {
    requisition: RequisitionData | null;
    work_order: WorkOrderFull | null;
    work_orders: WorkOrderOption[];
    materials: MaterialOption[];
    prefilled_items?: any[];
}

const emptyItem = (no: number): RequisitionItem => ({
    item_no: no,
    description: '',
    material_id: null,
    unit: 'pcs',
    required_qty: '',
    stock_qty: '',
    issue_qty: '',
    issue_date: '',
    remarks: '',
});

export default function MaterialRequisitionForm({ requisition, work_order, work_orders, materials, prefilled_items }: Props) {
    const isEdit = !!requisition?.id;

    // Prefer existing items > prefilled items from cost estimate > 1 empty row.
    const initialItems: RequisitionItem[] =
        requisition?.items && requisition.items.length > 0
            ? requisition.items
            : (prefilled_items && prefilled_items.length > 0
                ? prefilled_items.map((p: any) => ({
                    ...emptyItem(0),
                    material_id:  p.material_id ?? null,
                    description:  p.description ?? '',
                    unit:         p.unit ?? 'pcs',
                    required_qty: p.required_qty ?? 0,
                    stock_qty:    p.stock_qty ?? 0,
                    issue_qty:    p.issue_qty ?? 0,
                    remarks:      p.remarks ?? '',
                }))
                : [emptyItem(1)]);

    const prefilledEstimateNo = (prefilled_items && prefilled_items.length > 0)
        ? prefilled_items[0]?.estimate_no
        : null;

    const { data, setData, post, put, processing, errors } = useForm<{
        work_order_id: number | string;
        request_date: string;
        status: string;
        notes: string;
        items: RequisitionItem[];
    }>({
        work_order_id: requisition?.work_order_id ?? work_order?.id ?? '',
        request_date: requisition?.request_date ?? new Date().toISOString().slice(0, 10),
        status: requisition?.status ?? 'draft',
        notes: requisition?.notes ?? '',
        items: initialItems,
    });

    const selectedWorkOrder = useMemo<WorkOrderFull | WorkOrderOption | null>(() => {
        if (work_order) return work_order;
        const found = work_orders.find((w) => String(w.id) === String(data.work_order_id));
        return found ?? null;
    }, [work_order, work_orders, data.work_order_id]);

    const rfqItems: RfqItem[] =
        work_order?.id && String(work_order.id) === String(data.work_order_id)
            ? work_order.rfq_items ?? []
            : [];

    const updateItem = (index: number, field: keyof RequisitionItem, value: any) => {
        const items = [...data.items];
        items[index] = { ...items[index], [field]: value };
        setData('items', items);
    };

    const onMaterialChange = (index: number, materialId: string) => {
        const items = [...data.items];
        const id = materialId ? Number(materialId) : null;
        items[index] = { ...items[index], material_id: id };
        if (id) {
            const mat = materials.find((m) => m.id === id);
            if (mat) {
                // Pre-fill description with the material name if the preparer
                // hasn't typed anything yet — keeps the spec column tidy.
                if (!items[index].description) {
                    items[index].description = mat.name;
                }
                // Always pull the unit from the material master so the row
                // matches how that material is purchased (kg / L / pcs / set …).
                // Master is the source of truth here; preparer can still override.
                if (mat.unit) {
                    items[index].unit = mat.unit;
                }
            }
        }
        setData('items', items);
    };

    const addRow = () => {
        setData('items', [...data.items, emptyItem(data.items.length + 1)]);
    };

    const removeRow = (index: number) => {
        if (data.items.length <= 1) return;
        const items = data.items.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_no: i + 1 }));
        setData('items', items);
    };

    const computePending = (it: RequisitionItem) => {
        const req = Number(it.required_qty) || 0;
        const iss = Number(it.issue_qty) || 0;
        const pending = req - iss;
        return pending > 0 ? pending : 0;
    };

    const submit = (e: FormEvent, nextStatus?: string) => {
        e.preventDefault();
        if (nextStatus) {
            setData('status', nextStatus);
        }
        if (isEdit && requisition?.id) {
            put(`/pcd/material-requisitions/${requisition.id}`);
        } else {
            post('/pcd/material-requisitions');
        }
    };

    return (
        <AppLayout header={isEdit ? 'Edit Material Requisition' : 'New Material Requisition'}>
            <form onSubmit={(e) => submit(e)} className="space-y-6 animate-fade-in">
                {/* Header card */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-surface-900">Material Requisition Note</h2>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)
                                </p>
                                <p className="text-[11px] text-surface-400 mt-0.5">
                                    Bangladesh Industrial Technical Assistance Centre
                                </p>
                            </div>
                            <div className="text-right">
                                {isEdit && requisition?.mrn_number && (
                                    <div className="font-mono font-semibold text-brand-600 text-sm">
                                        {requisition.mrn_number}
                                    </div>
                                )}
                                <div className="text-[11px] text-surface-400 mt-0.5">
                                    {isEdit ? 'Editing requisition' : 'MRN assigned on save'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Work Order selector */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Work Order Reference</h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Select the work order this requisition is for
                        </p>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">Work Order</label>
                                {work_order ? (
                                    <div className="form-input bg-surface-50 cursor-not-allowed">
                                        <span className="font-mono font-semibold text-brand-600">
                                            {work_order.wo_number}
                                        </span>
                                        {work_order.customer && (
                                            <span className="text-surface-500"> — {work_order.customer}</span>
                                        )}
                                    </div>
                                ) : (
                                    <select
                                        value={data.work_order_id}
                                        onChange={(e) => setData('work_order_id', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="">-- Select work order --</option>
                                        {work_orders.map((wo) => (
                                            <option key={wo.id} value={wo.id}>
                                                {wo.wo_number}
                                                {wo.customer ? ` — ${wo.customer}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {errors.work_order_id && <div className="form-error">{errors.work_order_id}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Request Date</label>
                                <input
                                    type="date"
                                    value={data.request_date}
                                    onChange={(e) => setData('request_date', e.target.value)}
                                    className="form-input"
                                />
                                {errors.request_date && <div className="form-error">{errors.request_date}</div>}
                            </div>
                        </div>

                        {selectedWorkOrder && (
                            <div className="alert alert-info">
                                <div className="flex items-start gap-2">
                                    <i className="fi fi-rr-info text-sm leading-none mt-0.5" />
                                    <div className="text-xs">
                                        <div>
                                            <span className="font-semibold">WO:</span>{' '}
                                            <span className="font-mono">{selectedWorkOrder.wo_number}</span>
                                            {'job_number' in selectedWorkOrder && selectedWorkOrder.job_number && (
                                                <>
                                                    {' '}· <span className="font-semibold">Job:</span>{' '}
                                                    {selectedWorkOrder.job_number}
                                                </>
                                            )}
                                        </div>
                                        {selectedWorkOrder.customer && (
                                            <div className="mt-0.5">
                                                <span className="font-semibold">Customer:</span>{' '}
                                                {selectedWorkOrder.customer}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {rfqItems.length > 0 && (
                            <div className="rounded-lg border border-surface-100 bg-surface-50/60 p-3">
                                <div className="text-[11px] font-semibold uppercase text-surface-500 mb-2">
                                    Work Order Items (reference)
                                </div>
                                <ul className="space-y-1 text-xs text-surface-600">
                                    {rfqItems.map((ri, i) => (
                                        <li key={i} className="flex justify-between gap-2">
                                            <span>{ri.description}</span>
                                            <span className="font-mono text-surface-500">
                                                {ri.quantity} {ri.unit}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Items table */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Requisition Items</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                List of materials required for this work order
                            </p>
                        </div>
                        <button type="button" onClick={addRow} className="btn-outline btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" />
                            Add Row
                        </button>
                    </div>

                    {/* Pre-fill source banner — appears when items were auto-loaded from the cost estimate */}
                    {!isEdit && prefilledEstimateNo && (
                        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-start gap-2.5">
                            <i className="fi fi-rr-check-circle text-emerald-600 text-sm leading-none mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-emerald-900">
                                    Pre-filled from Cost Estimate <span className="font-mono">{prefilledEstimateNo}</span>
                                </p>
                                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                                    Materials are auto-populated from what was originally costed — quantities are scaled to this work order's job quantity.
                                    Review and adjust before saving.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="card-body overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th className="min-w-[200px]">
                                        Material <span className="text-red-500">*</span>
                                    </th>
                                    <th className="min-w-[280px]">
                                        Description
                                        <div className="text-[10px] font-normal text-surface-400">Size / thickness / spec</div>
                                    </th>
                                    <th className="w-28">Unit</th>
                                    <th className="w-32">Required</th>
                                    <th className="w-32">
                                        Stock
                                        <div className="text-[10px] font-normal text-surface-400">from IMS</div>
                                    </th>
                                    <th className="w-32">Issue Qty</th>
                                    <th className="w-24">Pending</th>
                                    <th className="w-40">Issue Date</th>
                                    <th className="min-w-[160px]">Remarks</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((it, index) => (
                                    <tr key={index} className="align-top">
                                        <td className="text-center font-semibold text-surface-600 pt-3">
                                            {it.item_no}
                                        </td>
                                        <td>
                                            <select
                                                value={it.material_id ?? ''}
                                                onChange={(e) => onMaterialChange(index, e.target.value)}
                                                className="form-select"
                                                required
                                            >
                                                <option value="">Select material…</option>
                                                {materials.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors[`items.${index}.material_id` as keyof typeof errors] && (
                                                <div className="form-error">
                                                    {errors[`items.${index}.material_id` as keyof typeof errors] as string}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <textarea
                                                value={it.description}
                                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                rows={2}
                                                className="form-textarea text-sm min-h-[60px]"
                                                // Override the form-textarea utility's `resize: none` so the
                                                // preparer can drag-resize each row's description as needed.
                                                style={{ resize: 'vertical' }}
                                                placeholder={"e.g. MS Plate 10mm thick\nØ50 × 200mm round bar"}
                                            />
                                            {errors[`items.${index}.description` as keyof typeof errors] && (
                                                <div className="form-error">
                                                    {errors[`items.${index}.description` as keyof typeof errors] as string}
                                                </div>
                                            )}
                                        </td>
                                        <td className="!px-2">
                                            <input
                                                type="text"
                                                value={it.unit}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                className="form-input !px-2 !py-2 text-center text-sm"
                                                placeholder="pcs"
                                            />
                                        </td>
                                        <td className="!px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.required_qty}
                                                onChange={(e) => updateItem(index, 'required_qty', e.target.value)}
                                                className="form-input !px-2 !py-2 text-right font-mono text-sm"
                                                placeholder="0"
                                                required
                                            />
                                        </td>
                                        <td className="!px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.stock_qty}
                                                onChange={(e) => updateItem(index, 'stock_qty', e.target.value)}
                                                className="form-input !px-2 !py-2 text-right font-mono text-sm"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="!px-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.issue_qty}
                                                onChange={(e) => updateItem(index, 'issue_qty', e.target.value)}
                                                className="form-input !px-2 !py-2 text-right font-mono text-sm"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="text-center font-semibold text-surface-700 pt-3">
                                            {computePending(it)}
                                        </td>
                                        <td className="!px-2">
                                            <input
                                                type="date"
                                                value={it.issue_date}
                                                onChange={(e) => updateItem(index, 'issue_date', e.target.value)}
                                                className="form-input !px-2 !py-2 text-sm"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={it.remarks}
                                                onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                                                className="form-input !px-3 !py-2 text-sm"
                                            />
                                        </td>
                                        <td className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeRow(index)}
                                                disabled={data.items.length <= 1}
                                                className="btn-ghost btn-xs text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Remove row"
                                            >
                                                <i className="fi fi-rr-trash text-xs leading-none" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Notes & Status */}
                <div className="card">
                    <div className="card-body space-y-4">
                        <div className="form-group">
                            <label className="form-label">
                                Notes <span className="form-label-optional">optional</span>
                            </label>
                            <textarea
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                className="form-textarea"
                                rows={3}
                                placeholder="Any additional instructions or remarks..."
                            />
                            {errors.notes && <div className="form-error">{errors.notes}</div>}
                        </div>

                        <div className="form-group max-w-xs">
                            <label className="form-label">Status</label>
                            <select
                                value={data.status}
                                onChange={(e) => setData('status', e.target.value)}
                                className="form-select"
                            >
                                <option value="draft">Draft</option>
                                <option value="pending_approval">Pending Approval</option>
                                <option value="approved">Approved</option>
                            </select>
                            {errors.status && <div className="form-error">{errors.status}</div>}
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href="/pcd/material-requisitions" className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" />
                        Back to list
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            type="button"
                            onClick={(e) => submit(e, 'draft')}
                            disabled={processing}
                            className="btn-outline btn-sm"
                        >
                            <i className="fi fi-rr-disk text-xs leading-none" />
                            Save Draft
                        </button>
                        <button
                            type="button"
                            onClick={(e) => submit(e, 'approved')}
                            disabled={processing}
                            className="btn-success btn-sm"
                        >
                            <i className="fi fi-rr-check text-xs leading-none" />
                            Save & Approve
                        </button>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
