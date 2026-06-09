import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useRef } from 'react';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';
import SearchableSelect from '@/Components/SearchableSelect';

interface PrefilledItem {
    rfq_item_id: number;
    description: string;
    quantity: number;
    unit: string;
    condition_note: string;
}

interface Props {
    rfq: { id: number; customer: string; customer_ref: string | null } | null;
    direction: 'in' | 'out';
    prefilled_items: PrefilledItem[];
}

interface Item {
    rfq_item_id: number | null;
    description: string;
    quantity: string;
    unit: string;
    condition_note: string;
}

export default function GatePassForm({ rfq, direction, prefilled_items, basePath = '/ied/gate-passes', directionLocked = false, condition_notes = [], customers = [] }: any) {
    const isIn = direction === 'in';
    const conditionOptions = (condition_notes ?? []).map((l: string) => ({ value: l, label: l }));
    const customerOptions = (customers ?? []).map((c: any) => ({
        value: c.id,
        label: c.name,
        sublabel: c.contact_person ?? undefined,
    }));

    const { data, setData, post, processing, errors } = useForm<any>({
        rfq_id:                 rfq?.id ?? '',
        direction,
        pass_date:              new Date().toISOString().slice(0, 10),
        customer_id:            rfq?.customer?.id ?? '',
        party_name:             rfq?.customer?.name ?? '',
        customer_rep_name:      '',
        customer_rep_phone:     '',
        customer_rep_id_number: '',
        vehicle_no:             '',
        notes:                  '',
        signature:              null as string | null,
        items: prefilled_items.length > 0
            ? prefilled_items.map((i: any) => ({
                rfq_item_id:    i.rfq_item_id,
                description:    i.description,
                quantity:       String(i.quantity),
                unit:           i.unit,
                condition_note: i.condition_note ?? '',
            }))
            : [{ rfq_item_id: null, description: '', quantity: '1', unit: 'pcs', condition_note: '' }],
    });

    const padRef = useRef<SignaturePadHandle | null>(null);

    const updateItem = (idx: number, patch: Partial<Item>) => {
        const next = [...(data.items as Item[])];
        next[idx] = { ...next[idx], ...patch };
        setData('items', next);
    };
    const addItem = () => setData('items', [...(data.items as Item[]), {
        rfq_item_id: null, description: '', quantity: '1', unit: 'pcs', condition_note: '',
    }]);
    const removeItem = (idx: number) => {
        const next = (data.items as Item[]).filter((_, i) => i !== idx);
        setData('items', next.length > 0 ? next : [{ rfq_item_id: null, description: '', quantity: '1', unit: 'pcs', condition_note: '' }]);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const sig = padRef.current?.toDataURL() ?? null;
        setData('signature', sig);
        // setData is async — defer the post by a frame so the form payload
        // actually includes the just-captured signature data URL.
        requestAnimationFrame(() => post(basePath));
    };

    return (
        <AppLayout header={`New ${isIn ? 'Gate-In' : 'Gate-Out'} Pass`}>
            <div className="max-w-5xl space-y-6 animate-fade-in">
                {/* Header banner */}
                <div className={`rounded-2xl border p-5 ${isIn ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${isIn ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                            <i className={`fi ${isIn ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt'} text-lg leading-none`} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-surface-900">
                                {isIn ? 'Gate-In Pass — Sample Entry' : 'Gate-Out Pass — Sample Return'}
                            </h1>
                            <p className="text-xs text-surface-700 mt-1">
                                {isIn
                                    ? 'Issue this pass when the customer is bringing a reference sample / item INTO BITAC. Security will record the entry against this pass.'
                                    : 'Issue this pass when the customer is taking the sample / finished item OUT of BITAC. Record its returned condition.'}
                            </p>
                            {rfq && (
                                <p className="text-xs text-surface-600 mt-2">
                                    <strong>RFQ #{rfq.id}</strong> · {rfq.customer}
                                    {rfq.customer_ref && <> · Ref <span className="font-mono">{rfq.customer_ref}</span></>}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Customer representative */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Customer Representative</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Whoever is physically bringing / collecting the sample at the gate.</p>
                        </div>
                        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group sm:col-span-2">
                                <label className="form-label">
                                    Party / Customer <span className="form-label-optional">pick from registered customers — links pass to their portal</span>
                                </label>
                                <SearchableSelect
                                    value={data.customer_id}
                                    onChange={(v) => {
                                        setData('customer_id', v as any);
                                        const c = customers.find((c: any) => String(c.id) === String(v));
                                        if (c) setData('party_name', c.name);
                                    }}
                                    options={customerOptions}
                                    placeholder="Search customer…"
                                    emptyText="No matching customer — use the override field below"
                                />
                                {data.customer_id ? (
                                    <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                        <i className="fi fi-rr-check-circle leading-none text-[10px]" />
                                        This pass will appear on the selected customer's portal.
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                        <i className="fi fi-rr-info leading-none text-[10px]" />
                                        Without a customer link, the pass won't surface on any customer portal — only the override name below will appear on the printed copy.
                                    </p>
                                )}
                                {errors.customer_id && <p className="form-error">{errors.customer_id as any}</p>}
                            </div>
                            <div className="form-group sm:col-span-2">
                                <label className="form-label">
                                    Party Name Override <span className="form-label-optional">free text — used on the printed pass</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.party_name}
                                    onChange={e => setData('party_name', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. ACI Motors Ltd., or visiting vendor name"
                                />
                                {errors.party_name && <p className="form-error">{errors.party_name as any}</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Representative Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={data.customer_rep_name}
                                    onChange={e => setData('customer_rep_name', e.target.value)}
                                    className="form-input"
                                    placeholder="Md. Rahim Uddin"
                                />
                                {errors.customer_rep_name && <p className="form-error">{errors.customer_rep_name as any}</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="tel"
                                    value={data.customer_rep_phone}
                                    onChange={e => setData('customer_rep_phone', e.target.value)}
                                    className="form-input"
                                    placeholder="01XXX-XXXXXX"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NID / Employee ID</label>
                                <input
                                    type="text"
                                    value={data.customer_rep_id_number}
                                    onChange={e => setData('customer_rep_id_number', e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Vehicle No</label>
                                <input
                                    type="text"
                                    value={data.vehicle_no}
                                    onChange={e => setData('vehicle_no', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. DHA-METRO-GA 12-3456"
                                />
                            </div>
                            <div className="form-group sm:col-span-2 max-w-xs">
                                <label className="form-label">Pass Date</label>
                                <input
                                    type="date"
                                    value={data.pass_date}
                                    onChange={e => setData('pass_date', e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Items {isIn ? 'Entering BITAC' : 'Leaving BITAC'}</h3>
                                <p className="text-xs text-surface-400 mt-0.5">List every physical item — description, qty, condition note.</p>
                            </div>
                            <button type="button" onClick={addItem} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                <i className="fi fi-rr-plus text-[10px] leading-none" /> Add row
                            </button>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-10">#</th>
                                        <th className="text-left px-3 py-2">Description</th>
                                        <th className="text-right px-3 py-2 w-20">Qty</th>
                                        <th className="text-left px-3 py-2 w-20">Unit</th>
                                        <th className="text-left px-3 py-2">Condition note</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-50">
                                    {(data.items as Item[]).map((item, idx) => (
                                        <tr key={idx} className="align-middle">
                                            <td className="px-4 py-3 text-xs text-surface-400 font-mono align-middle text-center">{idx + 1}</td>
                                            <td className="px-3 py-3 align-middle">
                                                <textarea
                                                    value={item.description}
                                                    onChange={e => updateItem(idx, { description: e.target.value })}
                                                    rows={2}
                                                    className="form-textarea text-sm"
                                                    placeholder="e.g. Worn pump impeller"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, { quantity: e.target.value })}
                                                    className="form-input text-sm text-right font-mono"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={e => updateItem(idx, { unit: e.target.value })}
                                                    className="form-input text-sm"
                                                    placeholder="pcs"
                                                />
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <SearchableSelect
                                                    size="sm"
                                                    value={item.condition_note}
                                                    onChange={(v) => updateItem(idx, { condition_note: String(v ?? '') })}
                                                    options={conditionOptions}
                                                    placeholder="Select condition…"
                                                    emptyText="No matching notes — add via Master Data → Gate Pass Notes"
                                                />
                                            </td>
                                            <td className="px-2 py-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(idx)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-red-50 hover:text-red-600"
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

                    {/* Notes + signature */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Notes</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Optional — additional remarks for security or audit.</p>
                            </div>
                            <div className="card-body">
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={5}
                                    className="form-textarea text-sm"
                                    placeholder="Special instructions, packaging, accompanying documents…"
                                />
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Issuer Signature</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Sign as the IED officer issuing this pass. Embedded on the printed copy.</p>
                            </div>
                            <div className="card-body">
                                <div className="relative">
                                    <SignaturePad ref={padRef} height={120} />
                                    <button
                                        type="button"
                                        onClick={() => padRef.current?.clear()}
                                        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 backdrop-blur text-[10px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 shadow-sm border border-surface-200"
                                        title="Clear signature"
                                    >
                                        <i className="fi fi-rr-eraser text-[10px] leading-none" /> Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Link href={rfq ? `/rfqs/${rfq.id}` : basePath} className="btn-ghost">Cancel</Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className={isIn ? 'btn-success' : 'btn-primary'}
                        >
                            <i className="fi fi-rr-disk text-xs leading-none" />
                            {processing ? 'Issuing…' : `Issue ${isIn ? 'Gate-In' : 'Gate-Out'} Pass`}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
