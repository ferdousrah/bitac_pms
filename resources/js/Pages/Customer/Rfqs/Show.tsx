import CustomerLayout from '@/Layouts/CustomerLayout';
import { Link, router } from '@inertiajs/react';

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
    const cancel = () => {
        if (!confirm('Cancel this RFQ? This cannot be undone.')) return;
        router.post(`/customer/rfqs/${rfq.id}/cancel`);
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

            {/* Quotation link if exists */}
            {rfq.latest_quotation && (
                <div className="card border-emerald-200 bg-emerald-50/40">
                    <div className="card-body flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                            <i className="fi fi-rr-receipt text-base leading-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-emerald-800">BITAC has sent you a quotation</div>
                            <div className="text-xs text-emerald-700/80 mt-0.5">
                                v{rfq.latest_quotation.version} · BDT {Number(rfq.latest_quotation.total_amount).toLocaleString('en-IN')} · {rfq.latest_quotation.created_at}
                            </div>
                        </div>
                        <Link href={`/customer/documents/quotation/${rfq.latest_quotation.id}`}
                            target="_blank"
                            className="btn-primary btn-sm shrink-0">
                            <i className="fi fi-rr-file-pdf text-xs" /> View PDF
                        </Link>
                    </div>
                </div>
            )}

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
        </CustomerLayout>
    );
}
