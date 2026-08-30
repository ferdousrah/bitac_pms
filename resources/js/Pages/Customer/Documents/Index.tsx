import { Link } from '@inertiajs/react';
import { useState } from 'react';
import CustomerLayout from '@/Layouts/CustomerLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';

const fmtBDT = (n: any) => `৳${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface PdfTarget { url: string; title: string; subtitle?: string }

const STATUS_BADGE: Record<string, string> = {
    issued: 'badge-blue',
    acknowledged: 'badge-blue',
    paid: 'badge-green',
    overdue: 'badge-red',
    scheduled: 'badge-amber',
    delivered: 'badge-green',
    cancelled: 'badge-red',
};

export default function CustomerDocumentsIndex({ workOrders, standaloneGatePasses = [] }: any) {
    const [pdf, setPdf] = useState<PdfTarget | null>(null);
    const openPdf = (t: PdfTarget) => setPdf(t);

    const hasAnything = workOrders.length > 0 || standaloneGatePasses.length > 0;

    return (
        <CustomerLayout title="Documents">
            <p className="text-sm text-surface-500 -mt-3">All documents for your orders in one place — quotation, delivery challan, inspection certificate, invoice, and gate passes.</p>

            {!hasAnything ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><i className="fi fi-rr-folder-open" /></div>
                        <p className="empty-state-title">No documents yet</p>
                        <p className="empty-state-text">Your order documents will appear here as your jobs progress.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Gate passes that aren't tied to a Work Order yet (e.g.
                        sample drop-off against a fresh RFQ). Customer needs to
                        be able to print/show these at BITAC's gate. */}
                    {standaloneGatePasses.length > 0 && (
                        <div className="card overflow-hidden">
                            <div className="card-header bg-rose-50/40 border-rose-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                        <i className="fi fi-rr-shield text-sm leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-900">Gate Passes</h3>
                                        <p className="text-[11px] text-surface-500 mt-0.5">Print and show these at BITAC's gate when bringing or collecting items.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body p-0 divide-y divide-surface-100">
                                {standaloneGatePasses.map((gp: any) => (
                                    <div key={gp.id}
                                        onClick={() => openPdf({
                                            url: `/customer/documents/gate-pass/${gp.id}?preview=base64`,
                                            title: `${gp.direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out'} ${gp.pass_no}`,
                                            subtitle: gp.customer_ref_no ? `Ref: ${gp.customer_ref_no}` : `RFQ #${gp.rfq_id}`,
                                        })}
                                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-50/70 transition-colors"
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                                            ${gp.direction === 'in' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
                                            <i className={`fi ${gp.direction === 'in' ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt'} text-sm leading-none`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs font-bold text-surface-900">{gp.pass_no}</span>
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-100 text-surface-600">
                                                    {gp.direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-surface-400 mt-0.5">
                                                {gp.pass_date ?? gp.issued_at} · RFQ #{gp.rfq_id}
                                                {gp.customer_ref_no && <span> · Ref: {gp.customer_ref_no}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold">
                                                <i className="fi fi-rr-file-pdf text-[9px] leading-none" /> PDF
                                            </span>
                                            <i className="fi fi-rr-arrow-right text-[10px] text-surface-300 leading-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {workOrders.map((wo: any) => (
                        <JobCard key={wo.id} wo={wo} onPreview={openPdf} />
                    ))}
                </div>
            )}

            <PdfPopupModal
                open={pdf !== null}
                pdfUrl={pdf?.url ?? null}
                title={pdf?.title ?? 'Document'}
                subtitle={pdf?.subtitle}
                onClose={() => setPdf(null)}
            />
        </CustomerLayout>
    );
}

function JobCard({ wo, onPreview }: { wo: any; onPreview: (t: PdfTarget) => void }) {
    const gatePasses = wo.gate_passes ?? [];
    const docCount = (wo.quotation ? 1 : 0) + wo.challans.length + wo.inspections.length + wo.invoices.length + gatePasses.length + (wo.completion_certificate ? 1 : 0);
    const jobLabel = `Job #${wo.job_number ?? '—'}`;

    return (
        <div className="card">
            <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shrink-0 shadow-md">
                        <i className="fi fi-rr-briefcase leading-none" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-surface-900">Job #{wo.job_number ?? '—'}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            <span className="font-mono">{wo.wo_number}</span>
                            {wo.product && <> · <span className="text-surface-700">{wo.product}</span></>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-surface-400">{docCount} document{docCount === 1 ? '' : 's'}</span>
                    <Link href={`/customer/work-orders/${wo.id}`} className="btn-outline btn-xs">
                        <i className="fi fi-rr-eye text-[10px]" /> Open
                    </Link>
                </div>
            </div>

            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Quotation */}
                <DocSection
                    title="Quotation"
                    icon="fi-rr-file-invoice-dollar"
                    color="indigo"
                    empty={!wo.quotation}
                    emptyText="No quotation linked"
                >
                    {wo.quotation && (
                        <DocLink
                            onClick={() => onPreview({
                                url: `/customer/documents/quotation/${wo.quotation.id}?preview=base64`,
                                title: `Quotation ${wo.quotation.quotation_no}`,
                                subtitle: jobLabel,
                            })}
                            label={wo.quotation.quotation_no}
                            ext="PDF"
                        />
                    )}
                </DocSection>

                {/* Delivery Challan */}
                <DocSection
                    title="Delivery Challan"
                    icon="fi-rr-truck-side"
                    color="amber"
                    empty={wo.challans.length === 0}
                    emptyText="No challan issued yet"
                >
                    {wo.challans.map((c: any) => (
                        <DocLink
                            key={c.id}
                            onClick={() => onPreview({
                                url: `/customer/documents/challan/${c.id}?preview=base64`,
                                title: `Delivery Challan ${c.challan_number}`,
                                subtitle: jobLabel,
                            })}
                            label={c.challan_number}
                            sub={c.delivered_at ? `Delivered ${c.delivered_at}` : c.date}
                            badge={c.status}
                            ext="PDF"
                        />
                    ))}
                </DocSection>

                {/* Inspection Certificate */}
                <DocSection
                    title="Inspection Certificate"
                    icon="fi-rr-shield-check"
                    color="emerald"
                    empty={wo.inspections.length === 0}
                    emptyText="No QC inspection on record"
                >
                    {wo.inspections.map((i: any) => (
                        <DocLink
                            key={i.id}
                            onClick={() => onPreview({
                                url: `/customer/documents/inspection/${i.id}?preview=base64`,
                                title: `Inspection Certificate IC-${String(i.id).padStart(5, '0')}`,
                                subtitle: jobLabel,
                            })}
                            label={`IC-${String(i.id).padStart(5, '0')}`}
                            sub={`${(i.inspection_type ?? '').replace(/_/g, ' ')} · ${i.inspected_at ?? ''}`}
                            badge={i.result}
                            ext="PDF"
                        />
                    ))}
                </DocSection>

                {/* Invoice */}
                <DocSection
                    title="Invoice"
                    icon="fi-rr-receipt"
                    color="teal"
                    empty={wo.invoices.length === 0}
                    emptyText="Invoice will appear after delivery"
                >
                    {wo.invoices.map((inv: any) => (
                        <DocLink
                            key={inv.id}
                            onClick={() => onPreview({
                                url: `/customer/invoices/${inv.id}/pdf?preview=base64`,
                                title: `Invoice ${inv.invoice_number}`,
                                subtitle: jobLabel,
                            })}
                            label={inv.invoice_number}
                            sub={`${fmtBDT(inv.total_amount)} · ${inv.issued_at ?? ''}`}
                            badge={inv.status}
                            ext="PDF"
                        />
                    ))}
                </DocSection>

                {/* Completion Certificate (customer-issued) */}
                <DocSection
                    title="Completion Certificate"
                    icon="fi-rr-diploma"
                    color="indigo"
                    empty={!wo.completion_certificate}
                    emptyText="Not yet issued"
                >
                    {wo.completion_certificate && (
                        <DocLink
                            onClick={() => onPreview({
                                url: `/customer/documents/completion-certificate/${wo.completion_certificate.id}?preview=base64`,
                                title: `Completion Certificate ${wo.completion_certificate.certificate_number}`,
                                subtitle: jobLabel,
                            })}
                            label={wo.completion_certificate.certificate_number}
                            sub={`${wo.completion_certificate.mode === 'self_issued' ? 'Self-issued' : 'Uploaded'} · ${wo.completion_certificate.issued_date}`}
                            ext={wo.completion_certificate.mode === 'self_issued' ? 'PDF' : 'FILE'}
                        />
                    )}
                </DocSection>

                {/* Gate Passes */}
                <DocSection
                    title="Gate Passes"
                    icon="fi-rr-shield"
                    color="rose"
                    empty={gatePasses.length === 0}
                    emptyText="No gate passes issued"
                >
                    {gatePasses.map((gp: any) => (
                        <DocLink
                            key={gp.id}
                            onClick={() => onPreview({
                                url: `/customer/documents/gate-pass/${gp.id}?preview=base64`,
                                title: `${gp.direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out'} ${gp.pass_no}`,
                                subtitle: jobLabel,
                            })}
                            label={gp.pass_no}
                            sub={`${gp.direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out'} · ${gp.pass_date ?? gp.issued_at ?? ''}`}
                            badge={gp.status}
                            ext="PDF"
                        />
                    ))}
                </DocSection>
            </div>
        </div>
    );
}

function DocSection({ title, icon, color, empty, emptyText, children }: any) {
    const colors: Record<string, string> = {
        indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100',
        amber:   'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        teal:    'bg-teal-50 text-teal-700 border-teal-100',
        rose:    'bg-rose-50 text-rose-700 border-rose-100',
    };
    return (
        <div className={`rounded-xl border ${colors[color] ?? 'bg-surface-50 border-surface-100'} p-3`}>
            <div className="flex items-center gap-2 mb-2">
                <i className={`fi ${icon} text-sm leading-none`} />
                <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
            </div>
            {empty ? (
                <div className="text-xs text-surface-500 italic">{emptyText}</div>
            ) : (
                <div className="space-y-1.5">{children}</div>
            )}
        </div>
    );
}

function DocLink({ onClick, label, sub, badge, ext = 'PDF' }: any) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg bg-white border border-surface-100 hover:border-brand-300 hover:shadow-sm transition-all text-left"
        >
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {ext}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-surface-800 truncate font-mono">{label}</div>
                {sub && <div className="text-[10px] text-surface-500 truncate">{sub}</div>}
            </div>
            {badge && (
                <span className={`badge ${STATUS_BADGE[badge] ?? 'badge-slate'} text-[9px] shrink-0`}>
                    {String(badge).replace(/_/g, ' ')}
                </span>
            )}
            <i className="fi fi-rr-eye text-surface-400 text-xs shrink-0" />
        </button>
    );
}
