import CustomerLayout from '@/Layouts/CustomerLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    pending:  'badge-amber',
    quoted:   'badge-blue',
    accepted: 'badge-green',
    rejected: 'badge-slate',
};

const STATUS_LABEL: Record<string, string> = {
    pending:  'Pending Review',
    quoted:   'Quotation Sent',
    accepted: 'Accepted',
    rejected: 'Cancelled',
};

const REFERENCE_LABEL: Record<string, string> = {
    none: 'No reference',
    drawing: 'Drawing',
    physical_sample: 'Physical sample',
    both: 'Drawing + Sample',
};

export default function CustomerRfqShow({ rfq }: any) {
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const [woOpen, setWoOpen] = useState(false);
    const woForm = useForm<any>({
        customer_po_no: '',
        due_date: '',
        notes: '',
        customer_po_file: null as File | null,
    });

    const cancel = () => {
        if (!confirm('Cancel this RFQ? This cannot be undone.')) return;
        router.post(`/customer/rfqs/${rfq.id}/cancel`);
    };

    const submitWorkOrder = (e: React.FormEvent) => {
        e.preventDefault();
        woForm.post(`/customer/rfqs/${rfq.id}/issue-work-order`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { setWoOpen(false); woForm.reset(); },
        });
    };

    return (
        <CustomerLayout backHref="/customer/rfqs" backLabel="My RFQs" width="narrow">
            {/* Header */}
            <div className="card">
                <div className="card-body flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Request for Quotation</div>
                        <h2 className="text-xl font-bold font-mono text-brand-600 mt-1">RFQ #{rfq.id}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                            <span><i className="fi fi-rr-calendar text-[10px]" /> Submitted {rfq.created_at}</span>
                            {rfq.required_by && <span><i className="fi fi-rr-clock text-[10px]" /> Required by {rfq.required_by}</span>}
                            {rfq.customer_ref_no && <span><i className="fi fi-rr-tag-alt text-[10px]" /> Ref {rfq.customer_ref_no}</span>}
                        </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[rfq.status] ?? 'badge-slate'} self-start`}>
                        {STATUS_LABEL[rfq.status] ?? rfq.status}
                    </span>
                </div>
            </div>

            {/* Work Order card — only when one has been issued */}
            {rfq.work_order && (() => {
                const wo = rfq.work_order;
                const accent: Record<string, string> = {
                    amber:   'border-amber-200 bg-amber-50/40 text-amber-900',
                    blue:    'border-blue-200 bg-blue-50/40 text-blue-900',
                    indigo:  'border-indigo-200 bg-indigo-50/40 text-indigo-900',
                    yellow:  'border-yellow-200 bg-yellow-50/40 text-yellow-900',
                    orange:  'border-orange-200 bg-orange-50/40 text-orange-900',
                    teal:    'border-teal-200 bg-teal-50/40 text-teal-900',
                    green:   'border-emerald-200 bg-emerald-50/40 text-emerald-900',
                    red:     'border-rose-200 bg-rose-50/40 text-rose-900',
                    gray:    'border-surface-200 bg-surface-50/40 text-surface-900',
                };
                const dot: Record<string, string> = {
                    amber: 'bg-amber-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
                    yellow: 'bg-yellow-500', orange: 'bg-orange-500', teal: 'bg-teal-500',
                    green: 'bg-emerald-500', red: 'bg-rose-500', gray: 'bg-surface-400',
                };
                const accentCls = accent[wo.status_color] ?? accent.gray;
                const dotCls    = dot[wo.status_color] ?? dot.gray;
                return (
                    <div className={`card border-2 ${accentCls}`}>
                        <div className="card-body">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-clipboard-list text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-sm font-bold">Work Order issued</div>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/80 border border-white text-[10px] font-bold uppercase tracking-wider">
                                            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                                            {wo.status_label}
                                        </span>
                                    </div>
                                    <div className="text-xs opacity-80 mt-0.5 flex flex-wrap items-center gap-2">
                                        <span className="font-mono font-semibold">{wo.wo_number}</span>
                                        {wo.due_date && <span>· Due {wo.due_date}</span>}
                                        {wo.priority && wo.priority !== 'normal' && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/70 text-[9px] font-bold uppercase tracking-wider">
                                                <i className="fi fi-rr-bolt text-[9px]" /> {wo.priority}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    href={`/customer/work-orders/${wo.id}`}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-white shadow-sm hover:shadow text-xs font-bold shrink-0"
                                >
                                    <i className="fi fi-rr-arrow-up-right-from-square text-xs" />
                                    Track Progress
                                </Link>
                            </div>
                            {typeof wo.progress_pct === 'number' && wo.progress_pct > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/60">
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">
                                        <span>Production Progress</span>
                                        <span>{Math.round(wo.progress_pct)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                                        <div className={`h-full ${dotCls} transition-all`} style={{ width: `${Math.min(100, wo.progress_pct)}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Quotation link if exists */}
            {rfq.latest_quotation && (() => {
                const q = rfq.latest_quotation;
                const fmt = (n: number) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const vat = Number(q.vat_amount ?? 0);
                const tax = Number(q.tax_amount ?? 0);
                const disc = Number(q.discount ?? 0);
                const total = Number(q.total_amount ?? 0);
                // Subtotal reverses the maths: total = subtotal + vat - disc + tax
                const subtotal = total - vat - tax + disc;
                return (
                    <div className="card border-emerald-200 bg-emerald-50/40">
                        <div className="card-body">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                                    <i className="fi fi-rr-receipt text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-emerald-800">BITAC has sent you a quotation</div>
                                    <div className="text-xs text-emerald-700/80 mt-0.5">v{q.version} · {q.created_at}</div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setPdfPopup({
                                            open:     true,
                                            url:      `/customer/documents/quotation/${q.id}?preview=base64`,
                                            title:    `Quotation v${q.version}`,
                                            subtitle: `BITAC · RFQ #${rfq.id}`,
                                        })}
                                        className="btn-primary btn-sm">
                                        <i className="fi fi-rr-file-pdf text-xs" /> Quotation PDF
                                    </button>
                                    {q.has_forwarding_letter && (
                                        <button
                                            type="button"
                                            onClick={() => setPdfPopup({
                                                open:     true,
                                                url:      `/customer/documents/quotation/${q.id}/forwarding-letter?preview=base64`,
                                                title:    `Forwarding Letter`,
                                                subtitle: `Quotation v${q.version} · RFQ #${rfq.id}`,
                                            })}
                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                                            <i className="fi fi-rr-envelope text-xs" /> Forwarding Letter
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Breakdown — VAT / Discount / Tax rows only show when non-zero */}
                            <div className="mt-4 pt-3 border-t border-emerald-200/60">
                                <div className="max-w-sm ml-auto space-y-1 text-xs">
                                    <div className="flex items-center justify-between text-emerald-800/80">
                                        <span>Subtotal</span>
                                        <span className="font-mono tabular-nums">৳{fmt(subtotal)}</span>
                                    </div>
                                    {vat > 0 && (
                                        <div className="flex items-center justify-between text-emerald-800/80">
                                            <span>VAT <span className="text-[10px] text-emerald-600/70">({q.vat_rate}%)</span></span>
                                            <span className="font-mono tabular-nums">+ ৳{fmt(vat)}</span>
                                        </div>
                                    )}
                                    {disc > 0 && (
                                        <div className="flex items-center justify-between text-emerald-700">
                                            <span>Discount</span>
                                            <span className="font-mono tabular-nums">− ৳{fmt(disc)}</span>
                                        </div>
                                    )}
                                    {tax > 0 && (
                                        <div className="flex items-center justify-between text-emerald-800/80">
                                            <span>Tax <span className="text-[10px] text-emerald-600/70">({q.tax_rate}%)</span></span>
                                            <span className="font-mono tabular-nums">+ ৳{fmt(tax)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2 border-t border-emerald-300/40 mt-1.5">
                                        <span className="text-sm font-bold text-emerald-900">Grand Total</span>
                                        <span className="text-base font-bold font-mono text-emerald-900 tabular-nums">৳{fmt(total)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Issue Work Order — customer self-serve when the
                                quotation is approved/sent and not yet converted. */}
                            {q.can_issue_work_order && (
                                <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between gap-3">
                                    <div className="text-xs text-emerald-800/80 flex-1">
                                        Ready to proceed? Issue a Work Order and BITAC will begin production planning.
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setWoOpen(true)}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shrink-0"
                                    >
                                        <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                        Issue Work Order
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Notes */}
            {rfq.notes && (
                <div className="card">
                    <div className="card-header"><h3 className="text-sm font-semibold text-surface-800">Notes</h3></div>
                    <div className="card-body">
                        <p className="text-sm text-surface-700 whitespace-pre-line">{rfq.notes}</p>
                    </div>
                </div>
            )}

            {/* Items */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-sm font-semibold text-surface-800">Job Items ({rfq.items.length})</h3>
                </div>
                <div className="card-body space-y-4">
                    {rfq.items.map((it: any, idx: number) => (
                        <div key={it.id} className="rounded-xl border border-surface-200 p-4 space-y-3 bg-surface-50/40">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Item #{idx + 1}</div>
                                    <p className="text-sm font-medium text-surface-900 mt-0.5">
                                        {it.product ?? it.job_description ?? '—'}
                                    </p>
                                    {it.product && it.job_description && (
                                        <p className="text-xs text-surface-500 mt-1">{it.job_description}</p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-semibold text-surface-900">{Number(it.quantity).toLocaleString('en-IN')}</div>
                                    <div className="text-[10px] text-surface-400">{it.unit}</div>
                                </div>
                            </div>

                            {it.notes && (
                                <p className="text-xs text-surface-600 italic">"{it.notes}"</p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-surface-400">
                                <span className="px-2 py-0.5 bg-surface-100 rounded-md font-semibold uppercase tracking-wider">
                                    {REFERENCE_LABEL[it.reference_type] ?? 'No reference'}
                                </span>
                            </div>

                            {it.drawings && it.drawings.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Drawings</div>
                                    <ul className="space-y-1">
                                        {it.drawings.map((f: any) => (
                                            <li key={f.id}>
                                                <a href={f.url} target="_blank" rel="noreferrer"
                                                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
                                                    <i className="fi fi-rr-document text-[10px] leading-none" /> {f.filename}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {it.sample_photos && it.sample_photos.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Sample Photos</div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {it.sample_photos.map((f: any) => (
                                            <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                                <img src={f.url} alt={f.filename}
                                                    className="w-full h-20 object-cover rounded-md border border-surface-200 hover:border-brand-400 transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <Link href="/customer/rfqs" className="btn-outline btn-sm">
                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> All RFQs
                </Link>
                {rfq.can_cancel && (
                    <button onClick={cancel}
                        className="btn-ghost btn-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                        <i className="fi fi-rr-cross-circle text-xs leading-none" /> Cancel RFQ
                    </button>
                )}
            </div>

            {/* PDF popup viewer — used for Quotation + Forwarding Letter */}
            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />

            {/* Issue Work Order Modal */}
            {woOpen && (
                <>
                    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => !woForm.processing && setWoOpen(false)} />
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl border border-surface-100 w-full max-w-lg max-h-[92vh] overflow-y-auto">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                                        <i className="fi fi-rr-paper-plane text-base leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold leading-tight">Issue Work Order</h3>
                                        <p className="text-[11px] text-white/80">RFQ #{rfq.id} · Quotation v{rfq.latest_quotation?.version}</p>
                                    </div>
                                </div>
                                <button onClick={() => !woForm.processing && setWoOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                                    <i className="fi fi-rr-cross text-sm leading-none" />
                                </button>
                            </div>
                            <form onSubmit={submitWorkOrder} className="p-5 space-y-4">
                                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2.5 text-[11px] text-emerald-800 flex items-start gap-2">
                                    <i className="fi fi-rr-info text-emerald-500 mt-0.5 shrink-0" />
                                    <span>BITAC's PCD team will set up Material Requisition, Routing and the Operation Sheet once this is issued. Priority is set to <b>Normal</b> by default.</span>
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Your PO Number <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={woForm.data.customer_po_no}
                                        onChange={e => woForm.setData('customer_po_no', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. PO/2026/0123"
                                        required
                                    />
                                    {woForm.errors.customer_po_no && <p className="form-error">{woForm.errors.customer_po_no as any}</p>}
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Required Delivery Date <span className="text-rose-500">*</span></label>
                                    <input
                                        type="date"
                                        value={woForm.data.due_date}
                                        onChange={e => woForm.setData('due_date', e.target.value)}
                                        min={new Date().toISOString().slice(0, 10)}
                                        className="form-input"
                                        required
                                    />
                                    {woForm.errors.due_date && <p className="form-error">{woForm.errors.due_date as any}</p>}
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Notes for BITAC <span className="form-label-optional">(optional)</span></label>
                                    <textarea
                                        value={woForm.data.notes}
                                        onChange={e => woForm.setData('notes', e.target.value)}
                                        rows={3}
                                        className="form-textarea text-sm"
                                        placeholder="Site contact, delivery address, special instructions…"
                                    />
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Work Order <span className="text-rose-500">*</span></label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                        onChange={e => woForm.setData('customer_po_file', e.target.files?.[0] ?? null)}
                                        className="block w-full text-xs text-surface-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-xs file:font-semibold hover:file:bg-emerald-100"
                                        required
                                    />
                                    {woForm.data.customer_po_file && (
                                        <p className="text-[10px] text-emerald-600 mt-1">Selected: <b>{(woForm.data.customer_po_file as File).name}</b></p>
                                    )}
                                    <p className="text-[10px] text-surface-500 mt-1">Upload your signed work order — PDF, image or Word document up to 10 MB.</p>
                                    {woForm.errors.customer_po_file && <p className="form-error">{woForm.errors.customer_po_file as any}</p>}
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-100">
                                    <button type="button" onClick={() => setWoOpen(false)} disabled={woForm.processing} className="btn-ghost btn-sm">Cancel</button>
                                    <button type="submit" disabled={woForm.processing} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm disabled:opacity-60">
                                        {woForm.processing ? (
                                            <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Issuing…</>
                                        ) : (
                                            <><i className="fi fi-rr-paper-plane text-xs leading-none" /> Issue Work Order</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </CustomerLayout>
    );
}
