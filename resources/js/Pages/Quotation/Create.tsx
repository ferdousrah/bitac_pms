import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';
import QuotationTermsAI from '@/Components/QuotationTermsAI';
import { useAiEnabled } from '@/lib/useAiEnabled';

const fmt = (v: number) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface LineItem {
    rfq_item_id?: number;
    description: string;
    quantity: number | string;
    unit?: string | null;
    unit_price: number | string;
    estimate_no?: string | null;
}

export default function QuotationCreate({ rfq, kickoffNote, vatRate: defaultVatRate = 15 }: any) {
    const aiEnabled = useAiEnabled();
    // Prepare initial line items from the RFQ (prefilled unit_price when estimate exists)
    const initialItems: LineItem[] = (rfq?.items ?? []).map((i: any) => ({
        rfq_item_id: i.rfq_item_id,
        description: i.description,
        quantity: i.quantity ?? 0,
        unit: i.unit ?? 'pcs',
        unit_price: i.unit_price ?? '',
        estimate_no: i.estimate_no ?? null,
    }));

    const { data, setData, post, errors, processing } = useForm<any>({
        rfq_id:            rfq?.id ?? '',
        vat_rate:          String(defaultVatRate),
        validity_days:     '30',
        notes:             '',
        items:             initialItems,
        attachments:       [] as File[],
        attachment_kinds:  [] as string[],
        save_as_draft:     false,
    });

    const onFilesPicked = (files: FileList | null) => {
        if (!files) return;
        const newFiles: File[] = Array.from(files);
        const merged = [...(data.attachments as File[]), ...newFiles];
        const mergedKinds = [...(data.attachment_kinds as string[]), ...newFiles.map(() => 'supporting')];
        setData('attachments', merged);
        setData('attachment_kinds', mergedKinds);
    };

    const removeFile = (idx: number) => {
        const files = (data.attachments as File[]).filter((_, i) => i !== idx);
        const kinds = (data.attachment_kinds as string[]).filter((_, i) => i !== idx);
        setData('attachments', files);
        setData('attachment_kinds', kinds);
    };

    const setFileKind = (idx: number, kind: string) => {
        const kinds = [...(data.attachment_kinds as string[])];
        kinds[idx] = kind;
        setData('attachment_kinds', kinds);
    };

    const humanSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const updateItem = (index: number, patch: Partial<LineItem>) => {
        const next = [...(data.items as LineItem[])];
        next[index] = { ...next[index], ...patch };
        setData('items', next);
    };

    // Live totals
    const { subtotal, vatAmount, grandTotal, lineAmounts } = useMemo(() => {
        const rate = parseFloat(data.vat_rate) || 0;
        const amounts = (data.items as LineItem[]).map((i) =>
            (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unit_price)) || 0)
        );
        const sub = amounts.reduce((a, b) => a + b, 0);
        const vat = sub * (rate / 100);
        return {
            subtotal:    sub,
            vatAmount:   vat,
            grandTotal:  sub + vat,
            lineAmounts: amounts,
        };
    }, [data.items, data.vat_rate]);

    const submit = (e: FormEvent, asDraft = false) => {
        e.preventDefault();
        setData('save_as_draft', asDraft);
        setTimeout(() => post('/quotations', { forceFormData: true }), 0);
    };

    return (
        <AppLayout header="New Quotation">
            <div className="max-w-5xl space-y-6 animate-fade-in">
                {kickoffNote && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                            <i className="fi fi-rr-comment-alt text-indigo-600 text-sm leading-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-600">
                                Handoff note from the estimator
                            </div>
                            <p className="text-sm text-indigo-900 mt-1 whitespace-pre-wrap leading-relaxed">
                                {kickoffNote}
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6">
                    {/* Request Details */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-document text-brand-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Request Details</h3>
                                    <p className="text-xs text-surface-400">RFQ reference and quotation validity</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            {rfq && (
                                <div className="alert alert-info">
                                    <i className="fi fi-rr-info text-blue-500 text-base leading-none mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm">RFQ #{rfq.id} — {rfq.customer?.name}</div>
                                        <p className="text-xs text-blue-600 mt-0.5">{initialItems.length} item{initialItems.length === 1 ? '' : 's'}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-calendar text-xs leading-none mr-1.5" />
                                        Validity (days)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={data.validity_days}
                                        onChange={e => setData('validity_days', e.target.value)}
                                        className="form-input"
                                        placeholder="30"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-percentage text-xs leading-none mr-1.5" />
                                        VAT Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={data.vat_rate}
                                        onChange={e => setData('vat_rate', e.target.value)}
                                        className="form-input"
                                        placeholder="15"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <i className="fi fi-rr-list text-emerald-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Line Items</h3>
                                    <p className="text-xs text-surface-400">Set the unit price for each item — amount updates live</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {(data.items as LineItem[]).length === 0 ? (
                                <div className="py-10 text-center text-xs text-surface-400">
                                    No line items found. Select an RFQ first.
                                </div>
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-surface-400 font-bold border-b border-surface-100">
                                                <th className="text-left px-5 py-2 w-10">#</th>
                                                <th className="text-left px-3 py-2">Description</th>
                                                <th className="text-right px-3 py-2 w-24">Qty</th>
                                                <th className="text-left px-3 py-2 w-20">Unit</th>
                                                <th className="text-right px-3 py-2 w-36">Unit Price</th>
                                                <th className="text-right px-5 py-2 w-36">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {(data.items as LineItem[]).map((item, idx) => (
                                                <tr key={idx} className="align-top">
                                                    <td className="px-5 py-3 text-xs text-surface-400 font-mono">{idx + 1}</td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={e => updateItem(idx, { description: e.target.value })}
                                                            className="form-input text-sm"
                                                            placeholder="Item description"
                                                            required
                                                        />
                                                        {item.estimate_no && (
                                                            <div className="text-[10px] text-emerald-600 mt-0.5 font-mono flex items-center gap-1">
                                                                <i className="fi fi-rr-link text-[9px] leading-none" />
                                                                Linked to {item.estimate_no}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
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
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="text"
                                                            value={item.unit ?? ''}
                                                            onChange={e => updateItem(idx, { unit: e.target.value })}
                                                            className="form-input text-sm"
                                                            placeholder="pcs"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.unit_price}
                                                            onChange={e => updateItem(idx, { unit_price: e.target.value })}
                                                            className="form-input text-sm text-right font-mono"
                                                            placeholder="0.00"
                                                            required
                                                        />
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-mono font-bold text-surface-900 tabular-nums">
                                                        {fmt(lineAmounts[idx] ?? 0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {errors.items && <p className="form-error mt-2">{errors.items}</p>}

                            {/* Totals */}
                            <div className="mt-6 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-800 p-5 text-white">
                                <div className="flex items-center gap-2 mb-4">
                                    <i className="fi fi-rr-receipt text-brand-400 text-sm leading-none" />
                                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Quotation Totals</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-surface-300">
                                        <span>Subtotal ({(data.items as LineItem[]).length} item{(data.items as LineItem[]).length === 1 ? '' : 's'})</span>
                                        <span className="font-mono tabular-nums">{fmt(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-surface-300">
                                        <span>VAT ({parseFloat(data.vat_rate) || 0}%)</span>
                                        <span className="font-mono tabular-nums">{fmt(vatAmount)}</span>
                                    </div>
                                    <div className="border-t border-surface-700 pt-3 mt-3 flex justify-between items-center">
                                        <span className="text-sm font-semibold text-surface-200">Grand Total</span>
                                        <span className="text-2xl font-bold text-white font-mono tracking-tight tabular-nums">{fmt(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <i className="fi fi-rr-paperclip text-amber-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Attachments</h3>
                                    <p className="text-xs text-surface-400">Annexures, pricing rationale, reference specs, customer docs</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-3">
                            {/* Drop zone */}
                            <label
                                htmlFor="quotation-file-input"
                                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/40 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer"
                                onDragOver={(e) => { e.preventDefault(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    onFilesPicked(e.dataTransfer.files);
                                }}
                            >
                                <div className="w-10 h-10 rounded-xl bg-white border border-surface-100 shadow-sm flex items-center justify-center">
                                    <i className="fi fi-rr-cloud-upload text-amber-500 text-base leading-none" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-surface-700">Drag & drop files here, or click to pick</p>
                                    <p className="text-[11px] text-surface-400 mt-0.5">Max 20 MB per file · PDF, images, DWG, DXF, Excel, Word, etc.</p>
                                </div>
                                <input
                                    id="quotation-file-input"
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        onFilesPicked(e.target.files);
                                        e.target.value = '';
                                    }}
                                />
                            </label>

                            {/* File list */}
                            {(data.attachments as File[]).length > 0 && (
                                <div className="space-y-1.5">
                                    {(data.attachments as File[]).map((f, idx) => {
                                        const ext = f.name.split('.').pop()?.toUpperCase() ?? 'FILE';
                                        return (
                                            <div key={idx} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-surface-100">
                                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-[10px] font-bold shrink-0">
                                                    {ext}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-surface-900 truncate">{f.name}</div>
                                                    <div className="text-[10px] text-surface-400">{humanSize(f.size)}</div>
                                                </div>
                                                <select
                                                    value={(data.attachment_kinds as string[])[idx] ?? 'supporting'}
                                                    onChange={e => setFileKind(idx, e.target.value)}
                                                    className="text-[11px] border border-surface-200 rounded-md px-2 py-1 bg-white"
                                                >
                                                    <option value="supporting">Supporting</option>
                                                    <option value="annexure">Annexure</option>
                                                    <option value="spec">Spec</option>
                                                    <option value="other">Other</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    title="Remove"
                                                >
                                                    <i className="fi fi-rr-trash text-xs leading-none" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {errors.attachments && <p className="form-error">{errors.attachments as any}</p>}
                        </div>
                    </div>

                    {/* Notes & Terms */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <i className="fi fi-rr-comment-alt text-purple-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Notes & Terms</h3>
                                    <p className="text-xs text-surface-400">Customer-facing terms or special conditions</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-3">
                            <div className="form-group mb-0">
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={6}
                                    className="form-textarea"
                                    placeholder="Validity, payment terms, delivery schedule, warranty, price escalation, taxes, dispute resolution..."
                                />
                                <div className="text-[10px] text-surface-400 mt-1 text-right">
                                    {data.notes.length > 0 && `${data.notes.length} character${data.notes.length === 1 ? '' : 's'}`}
                                </div>
                            </div>

                            {/* AI Assist — only when the master AI switch is on */}
                            {aiEnabled && (
                                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                            ✨ Oli AI Assist
                                        </span>
                                        <span className="text-[10px] text-indigo-500">— generate or polish customer-facing terms</span>
                                    </div>
                                    <QuotationTermsAI
                                        currentText={data.notes}
                                        onApplyText={(text) => setData('notes', text)}
                                        context={{
                                            rfq_id:        data.rfq_id,
                                            validity_days: data.validity_days,
                                            vat_rate:      data.vat_rate,
                                            items:         data.items,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={processing}
                            onClick={(e) => submit(e as any, true)}
                            className="btn-outline"
                        >
                            <i className="fi fi-rr-pencil text-xs leading-none" />
                            {processing ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            onClick={() => setData('save_as_draft', false)}
                            className="btn-primary"
                        >
                            <i className="fi fi-rr-paper-plane text-xs leading-none" />
                            {processing ? 'Saving...' : 'Create & Submit for Approval'}
                        </button>
                        <Link href="/quotations" className="btn-ghost">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
