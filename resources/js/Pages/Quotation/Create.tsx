import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';
import QuotationTermsAI from '@/Components/QuotationTermsAI';
import ForwardingLetterAI from '@/Components/ForwardingLetterAI';
import RichTextEditor from '@/Components/RichTextEditor';
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

export default function QuotationCreate({
    rfq,
    kickoffNote,
    vatRate: defaultVatRate = 15,
    defaultTaxRate = 0,
    defaultRecipient = '',
    defaultTerms = [],
    defaultCustomerRefNo = '',
    defaultCustomerRefDate = '',
    existing = null,
}: any) {
    // Edit mode flips the form to PUT-to-update instead of POST-to-create.
    const isEdit = !!existing;
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

    const { data, setData, post, transform, errors, processing } = useForm<any>({
        rfq_id:            rfq?.id ?? '',
        vat_rate:          String(existing?.vat_rate ?? defaultVatRate),
        tax_rate:          String(existing?.tax_rate ?? defaultTaxRate),
        show_tax_breakdown: existing?.show_tax_breakdown ?? false,
        notes:             existing?.notes ?? '',
        items:             initialItems,
        attachments:       [] as File[],
        attachment_kinds:  [] as string[],
        save_as_draft:     false,
        // BITAC letter header
        memo_no:            existing?.memo_no ?? '36.06.2692.028.51.',
        memo_date:          existing?.memo_date ?? new Date().toISOString().slice(0, 10),
        discount_type:      (existing?.discount_type ?? '') as '' | 'percent' | 'fixed',
        discount:           String(existing?.discount ?? '0'),
        forwarding_letter_subject: existing?.forwarding_letter_subject ?? '',
        forwarding_letter:  existing?.forwarding_letter ?? '',
        customer_ref_no:    existing?.customer_ref_no ?? defaultCustomerRefNo ?? '',
        customer_ref_date:  existing?.customer_ref_date ?? defaultCustomerRefDate ?? '',
        recipient_block:    existing?.recipient_block ?? defaultRecipient ?? '',
        terms:              (existing?.terms?.length > 0)
                                ? existing.terms
                                : ((defaultTerms as string[]).length > 0 ? defaultTerms : ['']),
    });

    // Terms list helpers
    const addTerm = () => setData('terms', [...(data.terms as string[]), '']);
    const updateTerm = (idx: number, value: string) => {
        const next = [...(data.terms as string[])];
        next[idx] = value;
        setData('terms', next);
    };
    const removeTerm = (idx: number) => {
        const next = (data.terms as string[]).filter((_, i) => i !== idx);
        setData('terms', next.length > 0 ? next : ['']);
    };
    const moveTerm = (idx: number, dir: -1 | 1) => {
        const next = [...(data.terms as string[])];
        const tgt = idx + dir;
        if (tgt < 0 || tgt >= next.length) return;
        [next[idx], next[tgt]] = [next[tgt], next[idx]];
        setData('terms', next);
    };

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

    // Live totals — unit prices are inclusive of BOTH VAT and Tax (mirrors the
    // cost estimate). So the line-item sum IS the grand total; VAT and Tax are
    // EMBEDDED portions extracted for display only — never added on top
    // (otherwise tax gets double-counted against the estimate).
    const { grandTotal, embeddedVat, taxAmount, lineAmounts, discountAmount } = useMemo(() => {
        const vatRate = parseFloat(data.vat_rate) || 0;
        const taxRate = parseFloat(data.tax_rate) || 0;
        const discInput = parseFloat(data.discount) || 0;
        const amounts = (data.items as LineItem[]).map((i) =>
            (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unit_price)) || 0)
        );
        const gross = amounts.reduce((a, b) => a + b, 0);
        // Both VAT and Tax computed on the same pre-tax base, like the estimate.
        const base = (vatRate + taxRate) > 0 ? gross / (1 + (vatRate + taxRate) / 100) : gross;
        const embedded = vatRate > 0 ? base * vatRate / 100 : 0;
        const tax = taxRate > 0 ? base * taxRate / 100 : 0;
        let discount = 0;
        if (data.discount_type === 'percent') discount = gross * discInput / 100;
        else if (data.discount_type === 'fixed') discount = discInput;
        discount = Math.min(discount, gross);
        return {
            grandTotal:  gross - discount,
            embeddedVat: embedded,
            taxAmount:   tax,
            lineAmounts: amounts,
            discountAmount: discount,
        };
    }, [data.items, data.vat_rate, data.tax_rate, data.discount, data.discount_type]);

    const submit = (e: FormEvent, asDraft = false) => {
        e.preventDefault();
        setData('save_as_draft', asDraft);
        if (isEdit) {
            // Update an existing draft — Laravel method spoofing for multipart PUT.
            transform((d: any) => ({ ...d, _method: 'put' }));
            setTimeout(() => post(`/quotations/${existing.id}`, { forceFormData: true }), 0);
        } else {
            setTimeout(() => post('/quotations', { forceFormData: true }), 0);
        }
    };

    return (
        <AppLayout header={isEdit ? `Edit Quotation #${existing.id} v${existing.version}` : 'New Quotation'}>
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-document text-xs leading-none mr-1.5" />
                                        নং (Memo No)
                                    </label>
                                    <input
                                        type="text"
                                        value={data.memo_no}
                                        onChange={e => setData('memo_no', e.target.value)}
                                        className="form-input font-mono text-xs"
                                        placeholder="36.06.2692.028.51.028(2).26.92"
                                    />
                                    {errors.memo_no && <p className="form-error">{errors.memo_no as any}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-calendar text-xs leading-none mr-1.5" />
                                        Memo Date
                                        <span className="ml-1 text-[9px] font-normal text-surface-400">(prints as Date)</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={data.memo_date}
                                        onChange={e => setData('memo_date', e.target.value)}
                                        className="form-input"
                                    />
                                    {data.memo_date && (
                                        <p className="text-[10px] text-surface-500 mt-1 font-mono">
                                            Prints as: {(() => {
                                                const [y, m, d] = String(data.memo_date).split('-');
                                                return `${d}/${m}/${y}`;
                                            })()}
                                        </p>
                                    )}
                                    {errors.memo_date && <p className="form-error">{errors.memo_date as any}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-link text-xs leading-none mr-1.5" />
                                        Customer Ref
                                        {defaultCustomerRefNo && <span className="ml-1 text-[9px] font-normal text-emerald-600">(from RFQ)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={data.customer_ref_no}
                                        onChange={e => setData('customer_ref_no', e.target.value)}
                                        className="form-input font-mono text-xs"
                                        placeholder="27.11.9100.406.01.701.26.86"
                                    />
                                    {errors.customer_ref_no && <p className="form-error">{errors.customer_ref_no as any}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        <i className="fi fi-rr-calendar text-xs leading-none mr-1.5" />
                                        Ref Date
                                        {defaultCustomerRefDate && <span className="ml-1 text-[9px] font-normal text-emerald-600">(RFQ date)</span>}
                                    </label>
                                    <input
                                        type="date"
                                        value={data.customer_ref_date}
                                        onChange={e => setData('customer_ref_date', e.target.value)}
                                        className="form-input"
                                    />
                                    {data.customer_ref_date && (
                                        <p className="text-[10px] text-surface-500 mt-1 font-mono">
                                            Prints as: {(() => {
                                                const [y, m, d] = String(data.customer_ref_date).split('-');
                                                return `${d}/${m}/${y}`;
                                            })()}
                                        </p>
                                    )}
                                    {errors.customer_ref_date && <p className="form-error">{errors.customer_ref_date as any}</p>}
                                </div>
                            </div>
                            <p className="text-[11px] text-surface-400 flex items-center gap-1.5">
                                <i className="fi fi-rr-info text-[10px] leading-none" />
                                Unit prices are VAT-inclusive. Subtotal, VAT and Tax are shown separately on the quotation.
                            </p>
                        </div>
                    </div>

                    {/* Recipient block — shown at the top of the printed letter */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
                                    <i className="fi fi-rr-marker text-sky-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Recipient (To Whom)</h3>
                                    <p className="text-xs text-surface-400">Appears top-left of the printed letter — e.g. Executive Engineer, Sylhet 225 MW CCPP, BPDB, Kumargaon, Sylhet.</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <textarea
                                value={data.recipient_block}
                                onChange={e => setData('recipient_block', e.target.value)}
                                rows={4}
                                className="form-textarea text-sm"
                                placeholder={'Executive Engineer\nSylhet 225 MW CCPP, BPDB,\nKumargaon, Sylhet.'}
                            />
                            {errors.recipient_block && <p className="form-error">{errors.recipient_block as any}</p>}
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

                            {/* VAT & Tax are inherited from the cost estimate and already
                                embedded in the unit prices. The preparer only decides whether
                                to break them out on the customer's copy. */}
                            <div className="mt-5 rounded-xl border border-surface-200 bg-surface-50/60 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-surface-800">Show VAT &amp; Tax to customer</p>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            {data.show_tax_breakdown
                                                ? `VAT (${parseFloat(data.vat_rate) || 0}%) and Tax (${parseFloat(data.tax_rate) || 0}%) will be itemised on the PDF and customer portal.`
                                                : 'Grand Total prints as “(incl. VAT & Tax)” — no separate VAT/Tax rows.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={data.show_tax_breakdown}
                                        onClick={() => setData('show_tax_breakdown', !data.show_tax_breakdown)}
                                        className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${data.show_tax_breakdown ? 'bg-brand-500' : 'bg-surface-300'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${data.show_tax_breakdown ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-surface-400 mt-2">
                                    Rates are inherited from the cost estimate and already included in the unit prices.
                                </p>
                            </div>

                            {/* Discount input — type toggle + amount */}
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Discount Type <span className="form-label-optional">(optional)</span></label>
                                    <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
                                        <button type="button"
                                            onClick={() => setData('discount_type', '')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${data.discount_type === '' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500'}`}>
                                            None
                                        </button>
                                        <button type="button"
                                            onClick={() => setData('discount_type', 'percent')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${data.discount_type === 'percent' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500'}`}>
                                            %
                                        </button>
                                        <button type="button"
                                            onClick={() => setData('discount_type', 'fixed')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${data.discount_type === 'fixed' ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500'}`}>
                                            ৳ Fixed
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">
                                        Discount {data.discount_type === 'percent' ? '(%)' : data.discount_type === 'fixed' ? '(৳)' : ''}
                                    </label>
                                    <input type="number" min={0} step="0.01"
                                        value={data.discount}
                                        onChange={e => setData('discount', e.target.value)}
                                        disabled={!data.discount_type}
                                        className="form-input font-mono disabled:bg-surface-50 disabled:text-surface-400"
                                        placeholder="0" />
                                    {data.discount_type && discountAmount > 0 && (
                                        <p className="form-hint text-emerald-600 font-semibold">− ৳{fmt(discountAmount)}</p>
                                    )}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="mt-6 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-800 p-5 text-white">
                                <div className="flex items-center gap-2 mb-4">
                                    <i className="fi fi-rr-receipt text-brand-400 text-sm leading-none" />
                                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Quotation Totals</span>
                                </div>
                                <div className="space-y-2.5 text-sm">
                                    {((data.show_tax_breakdown && (embeddedVat > 0 || taxAmount > 0)) || discountAmount > 0) && (
                                        <div className="space-y-1 pb-2 border-b border-white/10">
                                            {(data.show_tax_breakdown || discountAmount > 0) && (
                                                <div className="flex justify-between text-surface-300 text-xs">
                                                    <span>Subtotal{data.show_tax_breakdown ? ' (excl. VAT & Tax)' : ''}</span>
                                                    <span className="font-mono tabular-nums">{fmt(data.show_tax_breakdown ? grandTotal + discountAmount - embeddedVat - taxAmount : grandTotal + discountAmount)}</span>
                                                </div>
                                            )}
                                            {data.show_tax_breakdown && embeddedVat > 0 && (
                                                <div className="flex justify-between text-surface-300 text-xs">
                                                    <span>VAT @ {parseFloat(data.vat_rate) || 0}%</span>
                                                    <span className="font-mono tabular-nums">+ {fmt(embeddedVat)}</span>
                                                </div>
                                            )}
                                            {data.show_tax_breakdown && taxAmount > 0 && (
                                                <div className="flex justify-between text-surface-300 text-xs">
                                                    <span>Tax @ {parseFloat(data.tax_rate) || 0}%</span>
                                                    <span className="font-mono tabular-nums">+ {fmt(taxAmount)}</span>
                                                </div>
                                            )}
                                            {discountAmount > 0 && (
                                                <div className="flex justify-between text-emerald-300 text-xs">
                                                    <span>Discount {data.discount_type === 'percent' ? `@ ${parseFloat(data.discount) || 0}%` : ''}</span>
                                                    <span className="font-mono tabular-nums">− {fmt(discountAmount)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-1">
                                        <div>
                                            <span className="text-sm font-semibold text-surface-100">
                                                Grand Total{!data.show_tax_breakdown && (embeddedVat > 0 || taxAmount > 0) ? ' (incl. VAT & Tax)' : ''}
                                            </span>
                                            <div className="text-[10px] text-surface-400 mt-0.5">
                                                {(data.items as LineItem[]).length} item{(data.items as LineItem[]).length === 1 ? '' : 's'}
                                            </div>
                                        </div>
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

                    {/* Terms & Conditions — numbered list printed at the bottom of the letter */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                                        <i className="fi fi-rr-list-check text-rose-500 text-sm leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-900">দরপত্রের শর্ত সমূহ — Terms &amp; Conditions</h3>
                                        <p className="text-xs text-surface-400">Numbered list printed at the bottom of the customer letter</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTerm}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                                >
                                    <i className="fi fi-rr-plus text-[10px] leading-none" />
                                    Add term
                                </button>
                            </div>
                        </div>
                        <div className="card-body space-y-2">
                            {(data.terms as string[]).map((term, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                                        {idx + 1}
                                    </div>
                                    <textarea
                                        value={term}
                                        onChange={e => updateTerm(idx, e.target.value)}
                                        rows={2}
                                        className="form-textarea text-sm flex-1"
                                        placeholder="Term…"
                                    />
                                    <div className="flex flex-col gap-1 pt-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => moveTerm(idx, -1)}
                                            disabled={idx === 0}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-50 hover:text-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Move up"
                                        >
                                            <i className="fi fi-rr-angle-up text-[10px] leading-none" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveTerm(idx, 1)}
                                            disabled={idx === (data.terms as string[]).length - 1}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-50 hover:text-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Move down"
                                        >
                                            <i className="fi fi-rr-angle-down text-[10px] leading-none" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeTerm(idx)}
                                        className="w-7 h-7 mt-1 rounded-lg flex items-center justify-center text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                                        title="Remove"
                                    >
                                        <i className="fi fi-rr-trash text-xs leading-none" />
                                    </button>
                                </div>
                            ))}
                            {errors.terms && <p className="form-error">{errors.terms as any}</p>}
                        </div>
                    </div>

                    {/* Internal Notes — preparer's free-text, NOT printed as numbered terms */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <i className="fi fi-rr-comment-alt text-purple-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Additional Notes</h3>
                                    <p className="text-xs text-surface-400">Optional free-text remarks shown below the terms list</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-3">
                            <div className="form-group mb-0">
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={4}
                                    className="form-textarea"
                                    placeholder="Special conditions, exceptions, or remarks not covered by the standard terms above…"
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
                                            vat_rate:      data.vat_rate,
                                            items:         data.items,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Forwarding Letter — printed as a separate PDF that goes
                        alongside the quotation. Optional. */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <i className="fi fi-rr-envelope text-indigo-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Forwarding Letter <span className="text-[10px] font-normal text-surface-400">(optional)</span></h3>
                                    <p className="text-xs text-surface-400">A separate cover letter that ships with the quotation PDF.</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-3">
                            <div className="form-group !mb-0">
                                <label className="form-label">Subject</label>
                                <input type="text"
                                    value={data.forwarding_letter_subject}
                                    onChange={e => setData('forwarding_letter_subject', e.target.value)}
                                    placeholder="Quotation for ..."
                                    className="form-input" />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Body</label>
                                <RichTextEditor
                                    value={data.forwarding_letter}
                                    onChange={(html) => setData('forwarding_letter', html)}
                                    placeholder="Dear Sir/Madam, with reference to your RFQ … we are pleased to enclose our quotation for the captioned work."
                                    minHeight="220px"
                                />
                                <p className="form-hint flex items-center gap-1 mt-2">
                                    <i className="fi fi-rr-info text-[10px] leading-none" />
                                    Letterhead, ref no, date and your signature are added automatically by the PDF generator.
                                </p>

                                {/* AI assist — Draft or Polish the letter body */}
                                <div className="mt-3 p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100">
                                    <ForwardingLetterAI
                                        currentText={data.forwarding_letter}
                                        onApplyText={(text) => setData('forwarding_letter', text)}
                                        onApplySubject={(subject) => setData('forwarding_letter_subject', subject)}
                                        context={{
                                            rfq_id: data.rfq_id,
                                            customer_ref_no: data.customer_ref_no,
                                            subject: data.forwarding_letter_subject,
                                            validity_days: data.validity_days,
                                            vat_rate: data.vat_rate,
                                            items: data.items,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex items-center gap-3">
                        {isEdit ? (
                            <>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="btn-primary"
                                >
                                    <i className="fi fi-rr-disk text-xs leading-none" />
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </button>
                                <Link href={`/quotations/${existing.id}`} className="btn-ghost">Cancel</Link>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
