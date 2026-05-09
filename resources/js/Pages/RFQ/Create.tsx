import AppLayout from '@/Layouts/AppLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import FilePicker, { UserFileItem } from '@/Components/FilePicker/FilePicker';
import SampleDescriptionAI from '@/Components/SampleDescriptionAI';

const REFERENCE_OPTIONS = [
    { value: 'none',            label: 'None',             icon: 'fi-rr-ban' },
    { value: 'drawing',         label: 'Drawing',          icon: 'fi-rr-drafting-compass' },
    { value: 'physical_sample', label: 'Sample',           icon: 'fi-rr-cube' },
    { value: 'both',            label: 'Drawing + Sample', icon: 'fi-rr-layers' },
];

const COMMON_UNITS = ['pcs', 'set', 'kg', 'nos', 'pair', 'lot'];

// Attached file entry: either a fresh upload (File) or a gallery pick
type AttachedFile = {
    kind: 'upload';
    file: File;
    previewUrl?: string; // object URL for images
} | {
    kind: 'gallery';
    userFileId: number;
    url: string;
    filename: string;
};

type Item = {
    product_id: string;
    job_description: string;
    quantity: string;
    unit: string;
    notes: string;
    reference_type: string;
    drawings: AttachedFile[];
    sample_received: boolean;
    sample_description: string;
    sample_photos: AttachedFile[];
};

const emptyItem = (): Item => ({
    product_id: '',
    job_description: '',
    quantity: '1',
    unit: 'pcs',
    notes: '',
    reference_type: 'none',
    drawings: [],
    sample_received: false,
    sample_description: '',
    sample_photos: [],
});

export default function RFQCreate({ customers, products, rfq }: any) {
    const initialItems: Item[] = rfq?.items?.length
        ? rfq.items.map((i: any) => ({
            product_id:         String(i.product_id ?? ''),
            job_description:    i.job_description ?? '',
            quantity:           String(i.quantity ?? '1'),
            unit:               i.unit ?? 'pcs',
            notes:              i.notes ?? '',
            reference_type:     i.reference_type ?? 'none',
            drawings:           (i.existing_drawings ?? []).map((d: any) => ({
                                    kind: 'gallery' as const,
                                    userFileId: d.user_file_id,
                                    url: d.url,
                                    filename: d.filename,
                                })).filter((d: any) => d.userFileId),
            sample_received:    !!i.sample_received,
            sample_description: i.sample_description ?? '',
            sample_photos:      (i.existing_sample_photos ?? []).map((d: any) => ({
                                    kind: 'gallery' as const,
                                    userFileId: d.user_file_id,
                                    url: d.url,
                                    filename: d.filename,
                                })).filter((d: any) => d.userFileId),
          }))
        : [emptyItem()];

    // File picker state
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<{ index: number; field: 'drawing' | 'sample_photo' } | null>(null);

    const openPicker = (index: number, field: 'drawing' | 'sample_photo') => {
        setPickerTarget({ index, field });
        setPickerOpen(true);
    };

    const handlePickerSelect = (file: UserFileItem) => {
        if (!pickerTarget) return;
        const { index, field } = pickerTarget;
        const newAttachment: AttachedFile = {
            kind: 'gallery',
            userFileId: file.id,
            url: file.url,
            filename: file.original_name,
        };
        const updated = data.items.map((it, i) => {
            if (i !== index) return it;
            // Avoid duplicates
            const key = field === 'drawing' ? 'drawings' : 'sample_photos';
            const existing = it[key] as AttachedFile[];
            if (existing.some(a => a.kind === 'gallery' && a.userFileId === file.id)) return it;
            return { ...it, [key]: [...existing, newAttachment] };
        });
        setData('items', updated);
        setPickerOpen(false);
        setPickerTarget(null);
    };

    // Add uploaded files (possibly multiple) to an item
    const addUploadedFiles = (itemIndex: number, field: 'drawings' | 'sample_photos', files: FileList | null) => {
        if (!files || files.length === 0) return;
        const newAttachments: AttachedFile[] = Array.from(files).map(f => ({
            kind: 'upload',
            file: f,
            previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        }));
        const updated = data.items.map((it, i) =>
            i === itemIndex ? { ...it, [field]: [...(it[field] as AttachedFile[]), ...newAttachments] } : it
        );
        setData('items', updated);
    };

    // Remove a file from an item (by index within the list)
    const removeAttachment = (itemIndex: number, field: 'drawings' | 'sample_photos', attachmentIndex: number) => {
        const updated = data.items.map((it, i) => {
            if (i !== itemIndex) return it;
            const list = [...(it[field] as AttachedFile[])];
            const removed = list.splice(attachmentIndex, 1)[0];
            // Revoke object URL if it was an upload preview
            if (removed.kind === 'upload' && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return { ...it, [field]: list };
        });
        setData('items', updated);
    };

    const { data, setData, post, errors, processing, transform } = useForm({
        customer_id:     rfq?.customer_id ?? '',
        customer_ref_no: rfq?.customer_ref_no ?? '',
        required_by:     rfq?.required_by ?? '',
        notes:           rfq?.notes ?? '',
        items:           initialItems,
    });

    function setItemField<K extends keyof Item>(index: number, field: K, value: Item[K]) {
        const updated = data.items.map((it, i) => i === index ? { ...it, [field]: value } : it);
        setData('items', updated);
    }

    function addItem() {
        setData('items', [...data.items, emptyItem()]);
    }

    function removeItem(index: number) {
        if (data.items.length === 1) return;
        setData('items', data.items.filter((_, i) => i !== index));
    }

    // Transform form data: split AttachedFile[] into drawings[] (files) + drawing_file_ids[] (integers)
    const transformItems = (d: any) => {
        const items = d.items.map((item: Item) => {
            const drawings: File[] = [];
            const drawingFileIds: number[] = [];
            item.drawings.forEach(a => {
                if (a.kind === 'upload') drawings.push(a.file);
                else drawingFileIds.push(a.userFileId);
            });
            const samplePhotos: File[] = [];
            const samplePhotoFileIds: number[] = [];
            item.sample_photos.forEach(a => {
                if (a.kind === 'upload') samplePhotos.push(a.file);
                else samplePhotoFileIds.push(a.userFileId);
            });
            return {
                product_id: item.product_id,
                job_description: item.job_description,
                quantity: item.quantity,
                unit: item.unit,
                notes: item.notes,
                reference_type: item.reference_type,
                sample_received: item.sample_received,
                sample_description: item.sample_description,
                drawings,
                drawing_file_ids: drawingFileIds,
                sample_photos: samplePhotos,
                sample_photo_file_ids: samplePhotoFileIds,
            };
        });
        return { ...d, items };
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (rfq) {
            transform((d: any) => ({ ...transformItems(d), _method: 'put' }));
            post(`/rfqs/${rfq.id}`, { forceFormData: true });
        } else {
            transform((d: any) => transformItems(d));
            post('/rfqs', { forceFormData: true });
        }
    };

    return (
        <AppLayout header={rfq ? 'Edit RFQ' : 'New RFQ'}>
            <div className="max-w-3xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">

                    {/* ── Customer Details ──────────────────────────────── */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-user text-brand-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Customer Details</h3>
                                    <p className="text-xs text-surface-400">Customer and delivery information</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Customer *</label>
                                    <select value={data.customer_id} onChange={e => setData('customer_id', e.target.value)}
                                        className="form-select" required>
                                        <option value="">Select customer...</option>
                                        {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Customer Ref / PO No. <span className="form-label-optional">(optional)</span>
                                    </label>
                                    <input type="text" value={data.customer_ref_no}
                                        onChange={e => setData('customer_ref_no', e.target.value)}
                                        placeholder="e.g. PO-2024-123"
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">
                                        Required By <span className="form-label-optional">(optional)</span>
                                    </label>
                                    <input type="date" value={data.required_by}
                                        onChange={e => setData('required_by', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Internal Notes <span className="form-label-optional">(optional)</span>
                                    </label>
                                    <input type="text" value={data.notes}
                                        onChange={e => setData('notes', e.target.value)}
                                        placeholder="Special requirements, urgency..."
                                        className="form-input" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Job Items (with per-item reference material) ──── */}
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <i className="fi fi-rr-boxes text-blue-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Job Items</h3>
                                    <p className="text-xs text-surface-400">Each item can have its own reference drawing or sample</p>
                                </div>
                            </div>
                            <button type="button" onClick={addItem} className="btn-outline btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add Item
                            </button>
                        </div>
                        <div className="card-body space-y-5">
                            {data.items.map((item, index) => {
                                const hasDrawing = item.reference_type === 'drawing' || item.reference_type === 'both';
                                const hasSample  = item.reference_type === 'physical_sample' || item.reference_type === 'both';
                                return (
                                    <div key={index} className="rounded-xl border border-surface-200 p-4 space-y-4 relative bg-surface-50/50">
                                        <div className="flex items-center justify-between">
                                            <span className="badge badge-slate">Item {index + 1}</span>
                                            {data.items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(index)}
                                                    className="btn-ghost btn-xs text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    <i className="fi fi-rr-trash text-xs leading-none" /> Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label text-xs">Part / Job Description *</label>
                                            <input type="text" value={item.job_description}
                                                onChange={e => setItemField(index, 'job_description', e.target.value)}
                                                placeholder="e.g. Brass bush 2-inch, Pump shaft, Custom flange..."
                                                className="form-input" />
                                            {(errors as any)[`items.${index}.job_description`] && (
                                                <p className="form-error">{(errors as any)[`items.${index}.job_description`]}</p>
                                            )}

                                            {/* AI assist — analyses attached drawing(s) + sample photo(s) to draft the description */}
                                            {(item.drawings.length > 0 || item.sample_photos.length > 0) && (
                                                <div className="mt-2">
                                                    <SampleDescriptionAI
                                                        drawings={item.drawings as any}
                                                        samplePhotos={item.sample_photos as any}
                                                        jobDescription={item.job_description}
                                                        currentText={item.job_description}
                                                        onApplyText={(text) => setItemField(index, 'job_description', text)}
                                                        purpose="item_description"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="form-group">
                                                <label className="form-label text-xs">
                                                    Product Type <span className="form-label-optional">(optional)</span>
                                                </label>
                                                <select value={item.product_id}
                                                    onChange={e => setItemField(index, 'product_id', e.target.value)}
                                                    className="form-select">
                                                    <option value="">-- New / Custom --</option>
                                                    {products?.map((p: any) => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label text-xs">Quantity *</label>
                                                <input type="number" min="0.01" step="0.01" value={item.quantity}
                                                    onChange={e => setItemField(index, 'quantity', e.target.value)}
                                                    className="form-input" required />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label text-xs">Unit</label>
                                                <select value={item.unit}
                                                    onChange={e => setItemField(index, 'unit', e.target.value)}
                                                    className="form-select">
                                                    {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label text-xs">
                                                Item Notes <span className="form-label-optional">(optional)</span>
                                            </label>
                                            <input type="text" value={item.notes}
                                                onChange={e => setItemField(index, 'notes', e.target.value)}
                                                placeholder="Material, finish, tolerance, special requirement..."
                                                className="form-input" />
                                        </div>

                                        {/* ── Per-Item Reference Material ── */}
                                        <div className="pt-3 border-t border-surface-200 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <i className="fi fi-rr-document text-purple-500 text-xs leading-none" />
                                                <span className="text-xs font-semibold text-surface-700">Reference Material for this item</span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {REFERENCE_OPTIONS.map(opt => (
                                                    <label key={opt.value}
                                                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 cursor-pointer transition-all duration-150
                                                            ${item.reference_type === opt.value
                                                                ? 'border-brand-500 bg-brand-50 shadow-sm'
                                                                : 'border-surface-200 hover:border-surface-300 bg-white'}`}>
                                                        <input type="radio" name={`reference_type_${index}`} value={opt.value}
                                                            checked={item.reference_type === opt.value}
                                                            onChange={() => setItemField(index, 'reference_type', opt.value)}
                                                            className="sr-only" />
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                                            item.reference_type === opt.value
                                                                ? 'bg-brand-100 text-brand-600'
                                                                : 'bg-surface-100 text-surface-400'
                                                        }`}>
                                                            <i className={`fi ${opt.icon} text-xs leading-none`} />
                                                        </div>
                                                        <div className={`text-[10px] font-semibold text-center ${
                                                            item.reference_type === opt.value ? 'text-brand-700' : 'text-surface-600'
                                                        }`}>
                                                            {opt.label}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>

                                            {hasDrawing && (
                                                <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-3 space-y-2 animate-slide-up">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                                                            <i className="fi fi-rr-drafting-compass text-blue-500 text-xs leading-none" />
                                                            Drawings / Blueprints
                                                            {item.drawings.length > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 text-[9px] font-bold">
                                                                    {item.drawings.length}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <button type="button" onClick={() => openPicker(index, 'drawing')}
                                                            className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline decoration-dotted">
                                                            📂 Pick from Gallery
                                                        </button>
                                                    </div>

                                                    {/* Attached files list */}
                                                    {item.drawings.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            {item.drawings.map((att, attIdx) => {
                                                                const name = att.kind === 'upload' ? att.file.name : att.filename;
                                                                const previewUrl = att.kind === 'upload' ? att.previewUrl : att.url;
                                                                const isImage = att.kind === 'upload'
                                                                    ? att.file.type.startsWith('image/')
                                                                    : /\.(jpg|jpeg|png|gif|webp)$/i.test(att.filename);
                                                                return (
                                                                    <div key={attIdx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-blue-200">
                                                                        {isImage && previewUrl ? (
                                                                            <img src={previewUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                                                        ) : (
                                                                            <i className="fi fi-rr-file text-blue-500 text-sm" />
                                                                        )}
                                                                        <span className="text-xs font-mono font-semibold text-surface-700 truncate flex-1">
                                                                            {name}
                                                                        </span>
                                                                        {att.kind === 'gallery' && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                                                                                gallery
                                                                            </span>
                                                                        )}
                                                                        {att.kind === 'upload' && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                                                                                new
                                                                            </span>
                                                                        )}
                                                                        <button type="button"
                                                                            onClick={() => removeAttachment(index, 'drawings', attIdx)}
                                                                            className="text-surface-400 hover:text-red-500 text-xs">✕</button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                                                        onChange={e => {
                                                            addUploadedFiles(index, 'drawings', e.target.files);
                                                            e.target.value = '';
                                                        }}
                                                        className="w-full text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                                                    <p className="text-[10px] text-blue-600">PDF, JPG, PNG, DWG, DXF · max 10 MB each · select multiple at once</p>
                                                </div>
                                            )}

                                            {hasSample && (
                                                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 space-y-2 animate-slide-up">
                                                    <div className="flex items-center gap-2">
                                                        <input type="checkbox" id={`sample_received_${index}`}
                                                            checked={item.sample_received}
                                                            onChange={e => setItemField(index, 'sample_received', e.target.checked)}
                                                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-200" />
                                                        <label htmlFor={`sample_received_${index}`} className="text-xs font-semibold text-amber-900">
                                                            Physical sample received at BITAC
                                                        </label>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label text-[10px] text-amber-800">Sample Condition / Description</label>
                                                        <textarea value={item.sample_description}
                                                            onChange={e => setItemField(index, 'sample_description', e.target.value)}
                                                            rows={2} placeholder="e.g. Brass fitting, 2-inch, good condition..."
                                                            className="form-textarea border-amber-200 focus:border-amber-400 focus:ring-amber-100 text-xs" />

                                                        {/* AI assist — sample-specific (condition, defects, wear) */}
                                                        <div className="mt-2">
                                                            <SampleDescriptionAI
                                                                samplePhotos={item.sample_photos as any}
                                                                jobDescription={item.job_description}
                                                                currentText={item.sample_description}
                                                                onApplyText={(text) => setItemField(index, 'sample_description', text)}
                                                                purpose="sample_description"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="form-group">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="form-label text-[10px] text-amber-800 mb-0 flex items-center gap-1.5">
                                                                Sample Photos <span className="form-label-optional">(optional)</span>
                                                                {item.sample_photos.length > 0 && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">
                                                                        {item.sample_photos.length}
                                                                    </span>
                                                                )}
                                                            </label>
                                                            <button type="button" onClick={() => openPicker(index, 'sample_photo')}
                                                                className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 underline decoration-dotted">
                                                                📂 Pick from Gallery
                                                            </button>
                                                        </div>

                                                        {item.sample_photos.length > 0 && (
                                                            <div className="space-y-1.5 mb-2">
                                                                {item.sample_photos.map((att, attIdx) => {
                                                                    const name = att.kind === 'upload' ? att.file.name : att.filename;
                                                                    const previewUrl = att.kind === 'upload' ? att.previewUrl : att.url;
                                                                    return (
                                                                        <div key={attIdx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200">
                                                                            {previewUrl && (
                                                                                <img src={previewUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                                                            )}
                                                                            <span className="text-xs font-mono font-semibold text-surface-700 truncate flex-1">
                                                                                {name}
                                                                            </span>
                                                                            {att.kind === 'gallery' && (
                                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                                                                                    gallery
                                                                                </span>
                                                                            )}
                                                                            {att.kind === 'upload' && (
                                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
                                                                                    new
                                                                                </span>
                                                                            )}
                                                                            <button type="button"
                                                                                onClick={() => removeAttachment(index, 'sample_photos', attIdx)}
                                                                                className="text-surface-400 hover:text-red-500 text-xs">✕</button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        <input type="file" multiple accept="image/*"
                                                            onChange={e => {
                                                                addUploadedFiles(index, 'sample_photos', e.target.files);
                                                                e.target.value = '';
                                                            }}
                                                            className="w-full text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200" />
                                                        <p className="text-[10px] text-amber-600 mt-1">Select multiple at once · max 5 MB each</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {errors.items && <p className="form-error">{errors.items}</p>}
                        </div>
                    </div>

                    {/* ── Submit ────────────────────────────────────────── */}
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            <i className="fi fi-rr-check text-xs leading-none" />
                            {processing ? 'Saving...' : rfq ? 'Update RFQ' : 'Create RFQ'}
                        </button>
                        <a href="/rfqs" className="btn-outline">Cancel</a>
                    </div>
                </form>

                {/* File Picker Modal */}
                <FilePicker
                    open={pickerOpen}
                    onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
                    onSelect={handlePickerSelect}
                    defaultCategory={pickerTarget?.field === 'drawing' ? 'drawing' : 'sample_photo'}
                    uploadCategory={pickerTarget?.field === 'drawing' ? 'drawing' : 'sample_photo'}
                    accept={pickerTarget?.field === 'drawing'
                        ? '.pdf,.jpg,.jpeg,.png,.dwg,.dxf'
                        : 'image/*'}
                    title={pickerTarget?.field === 'drawing' ? 'Pick or Upload Drawing' : 'Pick or Upload Sample Photo'}
                />
            </div>
        </AppLayout>
    );
}
