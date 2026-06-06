import CustomerLayout from '@/Layouts/CustomerLayout';
import SearchableSelect from '@/Components/SearchableSelect';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

const REFERENCE_OPTIONS = [
    { value: 'none',            label: 'None' },
    { value: 'drawing',         label: 'Drawing' },
    { value: 'physical_sample', label: 'Physical Sample' },
    { value: 'both',            label: 'Drawing + Sample' },
];

const COMMON_UNITS = ['pcs', 'set', 'kg', 'nos', 'pair', 'lot', 'm', 'ft'];

interface Item {
    job_description: string;
    product_id: string | number | '';
    quantity: string;
    unit: string;
    notes: string;
    reference_type: 'none' | 'drawing' | 'physical_sample' | 'both';
    sample_description: string;
    drawings: File[];
    sample_photos: File[];
}

const emptyItem = (): Item => ({
    job_description: '',
    product_id: '',
    quantity: '',
    unit: 'pcs',
    notes: '',
    reference_type: 'none',
    sample_description: '',
    drawings: [],
    sample_photos: [],
});

export default function CustomerRfqCreate({ products = [] }: any) {
    const { data, setData, post, errors, processing } = useForm<{
        customer_ref_no: string;
        required_by: string;
        notes: string;
        items: Item[];
    }>({
        customer_ref_no: '',
        required_by: '',
        notes: '',
        items: [emptyItem()],
    });

    const setItem = <K extends keyof Item>(idx: number, field: K, value: Item[K]) => {
        const next = data.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
        setData('items', next);
    };

    const addItem = () => setData('items', [...data.items, emptyItem()]);
    const removeItem = (idx: number) => {
        if (data.items.length === 1) return;
        setData('items', data.items.filter((_, i) => i !== idx));
    };

    const onFilesPicked = (idx: number, field: 'drawings' | 'sample_photos', files: FileList | null) => {
        if (!files) return;
        const existing = data.items[idx][field];
        setItem(idx, field, [...existing, ...Array.from(files)]);
    };

    const removeFile = (idx: number, field: 'drawings' | 'sample_photos', fileIdx: number) => {
        setItem(idx, field, data.items[idx][field].filter((_, i) => i !== fileIdx));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/customer/rfqs', { forceFormData: true });
    };

    const errorKeys = Object.keys(errors as any);

    return (
        <CustomerLayout backHref="/customer/rfqs" backLabel="My RFQs" title="New RFQ" width="narrow">
            <form onSubmit={submit} className="space-y-6">

                {/* Global validation error banner — shows every field-level
                    error so customers never get stuck wondering why submit
                    appears to do nothing. */}
                {errorKeys.length > 0 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                        <div className="flex items-start gap-2.5">
                            <i className="fi fi-rr-exclamation text-rose-600 mt-0.5 text-base leading-none" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-rose-800 mb-1.5">Please fix these errors:</p>
                                <ul className="text-xs text-rose-700 space-y-0.5 list-disc list-inside">
                                    {errorKeys.map(k => (
                                        <li key={k}>
                                            <span className="font-mono text-[10px] opacity-60">{k}</span>: {(errors as any)[k]}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">Request for Quotation</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Tell BITAC what you need. The IED team will review and send you a formal quotation.
                        </p>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">Your Ref / PO No. <span className="form-label-optional">optional</span></label>
                                <input type="text" value={data.customer_ref_no}
                                    onChange={e => setData('customer_ref_no', e.target.value)}
                                    placeholder="e.g. PO-2026-123"
                                    className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Required By <span className="form-label-optional">optional</span></label>
                                <input type="date" value={data.required_by}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={e => setData('required_by', e.target.value)}
                                    className="form-input" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notes / Special Instructions <span className="form-label-optional">optional</span></label>
                            <textarea value={data.notes}
                                onChange={e => setData('notes', e.target.value)}
                                rows={2}
                                placeholder="Anything BITAC should know — urgency, payment, delivery preferences, etc."
                                className="form-textarea" />
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Job Items</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Each row is a separate part / job.</p>
                        </div>
                        <button type="button" onClick={addItem} className="btn-outline btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> Add Item
                        </button>
                    </div>
                    <div className="card-body space-y-5">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="rounded-xl border border-surface-200 p-4 space-y-4 bg-surface-50/30">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-surface-700 uppercase tracking-wider">Item #{idx + 1}</span>
                                    {data.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(idx)}
                                            className="text-rose-600 hover:text-rose-700 text-xs font-semibold inline-flex items-center gap-1">
                                            <i className="fi fi-rr-trash text-[10px] leading-none" /> Remove
                                        </button>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Part Description <span className="text-red-500">*</span></label>
                                    <textarea value={item.job_description}
                                        onChange={e => setItem(idx, 'job_description', e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Pump impeller Ø180 mm, SS304, balanced"
                                        className="form-textarea"
                                        required={!item.product_id} />
                                    {(errors as any)[`items.${idx}.job_description`] && <p className="form-error">{(errors as any)[`items.${idx}.job_description`]}</p>}
                                </div>

                                {products.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Or pick from BITAC catalog <span className="form-label-optional">optional</span></label>
                                        <SearchableSelect
                                            value={item.product_id}
                                            onChange={(v) => setItem(idx, 'product_id', v as any)}
                                            options={products.map((p: any) => ({
                                                value: p.id,
                                                label: p.name,
                                                sublabel: p.code,
                                            }))}
                                            placeholder="Search BITAC product catalog…"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="form-group">
                                        <label className="form-label">Quantity <span className="text-red-500">*</span></label>
                                        <input type="number" min="0.01" step="0.01"
                                            value={item.quantity}
                                            onChange={e => setItem(idx, 'quantity', e.target.value)}
                                            placeholder="0"
                                            className="form-input font-mono"
                                            required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unit</label>
                                        <select value={item.unit}
                                            onChange={e => setItem(idx, 'unit', e.target.value)}
                                            className="form-select">
                                            {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reference</label>
                                        <select value={item.reference_type}
                                            onChange={e => setItem(idx, 'reference_type', e.target.value as any)}
                                            className="form-select">
                                            {REFERENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Drawings upload */}
                                {['drawing', 'both'].includes(item.reference_type) && (
                                    <div className="form-group">
                                        <label className="form-label">Drawing Files</label>
                                        <input type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                                            multiple
                                            onChange={e => onFilesPicked(idx, 'drawings', e.target.files)}
                                            className="block w-full text-sm text-surface-500
                                                       file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                                       file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700
                                                       hover:file:bg-brand-100 file:cursor-pointer" />
                                        <p className="text-[10px] text-surface-400 mt-1">PDF / JPG / PNG / DWG / DXF. Max 10 MB each.</p>
                                        {item.drawings.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {item.drawings.map((f, i) => (
                                                    <li key={i} className="flex items-center justify-between text-xs bg-white border border-surface-200 rounded-md px-2 py-1">
                                                        <span className="truncate">{f.name}</span>
                                                        <button type="button" onClick={() => removeFile(idx, 'drawings', i)}
                                                            className="text-rose-600 ml-2">
                                                            <i className="fi fi-rr-cross-small text-xs leading-none" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {['physical_sample', 'both'].includes(item.reference_type) && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Sample Description</label>
                                            <textarea value={item.sample_description}
                                                onChange={e => setItem(idx, 'sample_description', e.target.value)}
                                                rows={2}
                                                placeholder="Describe the sample you'll bring or its condition"
                                                className="form-textarea" />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Sample Photos</label>
                                            <input type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                multiple
                                                onChange={e => onFilesPicked(idx, 'sample_photos', e.target.files)}
                                                className="block w-full text-sm text-surface-500
                                                           file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                                           file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700
                                                           hover:file:bg-brand-100 file:cursor-pointer" />
                                            <p className="text-[10px] text-surface-400 mt-1">JPG / PNG / WebP. Max 5 MB each.</p>
                                            {item.sample_photos.length > 0 && (
                                                <div className="mt-2 grid grid-cols-3 gap-2">
                                                    {item.sample_photos.map((f, i) => (
                                                        <div key={i} className="relative">
                                                            <img src={URL.createObjectURL(f)} alt={f.name}
                                                                className="w-full h-16 object-cover rounded-md border border-surface-200" />
                                                            <button type="button" onClick={() => removeFile(idx, 'sample_photos', i)}
                                                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center shadow">
                                                                <i className="fi fi-rr-cross-small leading-none" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Item Notes <span className="form-label-optional">optional</span></label>
                                    <input type="text" value={item.notes}
                                        onChange={e => setItem(idx, 'notes', e.target.value)}
                                        placeholder="Special tolerances, material grade, finish requirements…"
                                        className="form-input" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3">
                    <button type="submit" disabled={processing} className="btn-primary">
                        {processing
                            ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                            : <><i className="fi fi-rr-paper-plane text-sm" /> Submit RFQ to BITAC</>}
                    </button>
                </div>
            </form>
        </CustomerLayout>
    );
}
