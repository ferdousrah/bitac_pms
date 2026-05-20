import { Link } from '@inertiajs/react';
import { useState } from 'react';
import CustomerLayout from '@/Layouts/CustomerLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    draft:        'badge-slate',
    issued:       'badge-blue',
    acknowledged: 'badge-blue',
    paid:         'badge-green',
    overdue:      'badge-red',
};

const paymentMethodLabel: Record<string, string> = {
    cash: 'Cash',
    cheque: 'Cheque',
    bank_transfer: 'Bank Transfer',
    online: 'Online / Mobile Banking',
    other: 'Other',
};

const fmtBDT = (n: any) => `৳${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CustomerInvoiceShow({ invoice }: any) {
    const isPaid = invoice.status === 'paid';
    const [showPdf, setShowPdf] = useState(false);

    return (
        <CustomerLayout backHref="/customer/invoices" backLabel="All Invoices" width="narrow">
            {/* Header */}
            <div className="card">
                <div className="card-body flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Invoice</div>
                        <h2 className="text-xl font-bold font-mono text-surface-900 mt-1">{invoice.invoice_number}</h2>
                        <p className="text-surface-500 text-xs mt-1">
                            Job #<span className="font-bold text-surface-700">{invoice.job_number ?? '—'}</span>
                            <span className="mx-1.5 text-surface-300">·</span>
                            <Link href={`/customer/work-orders/${invoice.work_order_id}`} className="font-mono text-brand-600 hover:underline">
                                {invoice.wo_number}
                            </Link>
                            {invoice.challan_number && (
                                <>
                                    <span className="mx-1.5 text-surface-300">·</span>
                                    Challan: <span className="font-mono">{invoice.challan_number}</span>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="text-left sm:text-right">
                        <div className="text-2xl font-bold font-mono text-surface-900">{fmtBDT(invoice.total_amount)}</div>
                        <span className={`badge mt-2 ${STATUS_BADGE[invoice.status] ?? 'badge-slate'}`}>{invoice.status}</span>
                    </div>
                </div>

                <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm border-t border-surface-100 pt-5">
                    <div>
                        <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Issued</dt>
                        <dd className="text-surface-900 mt-1">{invoice.issued_date ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Due</dt>
                        <dd className="text-surface-900 mt-1">{invoice.due_date ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Payment Terms</dt>
                        <dd className="text-surface-900 mt-1">{invoice.payment_terms ?? 'Net 30 days'}</dd>
                    </div>
                </div>
            </div>

            {/* Paid banner */}
            {isPaid && (
                <div className="card border-emerald-300 overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="fi fi-rr-badge-check text-base leading-none" />
                            <span className="text-sm font-bold uppercase tracking-wider">Payment Received</span>
                        </div>
                        <span className="text-[11px] text-white/90">{invoice.paid_at}</span>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div>
                            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Amount</div>
                            <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">{fmtBDT(invoice.paid_amount)}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Method</div>
                            <div className="text-sm font-semibold text-surface-900 mt-0.5">{paymentMethodLabel[invoice.payment_method] ?? invoice.payment_method ?? '—'}</div>
                        </div>
                        {invoice.payment_reference && (
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Reference</div>
                                <div className="text-sm font-mono text-surface-800 mt-0.5">{invoice.payment_reference}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Amounts */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-sm font-semibold text-surface-800">Amount Details</h3>
                </div>
                <div className="card-body">
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between py-2 border-b border-surface-100">
                            <span className="text-surface-600">Subtotal</span>
                            <span className="font-mono text-surface-900">{fmtBDT(invoice.subtotal)}</span>
                        </div>
                        {Number(invoice.discount) > 0 && (
                            <div className="flex justify-between py-2 border-b border-surface-100 text-red-600">
                                <span>Discount</span>
                                <span className="font-mono">- {fmtBDT(invoice.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-2 border-b border-surface-100">
                            <span className="text-surface-600">VAT ({invoice.vat_rate}%)</span>
                            <span className="font-mono text-surface-900">{fmtBDT(invoice.vat_amount)}</span>
                        </div>
                        <div className="flex justify-between py-3 mt-1 font-bold text-base border-t-2 border-surface-200">
                            <span className="text-surface-900">Total</span>
                            <span className="font-mono text-surface-900">{fmtBDT(invoice.total_amount)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setShowPdf(true)} className="btn-primary btn-sm">
                    <i className="fi fi-rr-file-pdf text-xs leading-none" /> View PDF
                </button>
                <a href={`/customer/invoices/${invoice.id}/download`} className="btn-outline btn-sm">
                    <i className="fi fi-rr-download text-xs leading-none" /> Download
                </a>
                <Link href="/customer/invoices" className="btn-ghost btn-sm">
                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                </Link>
            </div>

            {/* Payment instructions reminder if unpaid */}
            {!isPaid && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
                    <div className="font-semibold text-amber-900 mb-1">Payment Instructions</div>
                    <p className="text-amber-800 leading-relaxed">
                        Please make payment by Account Payee Cheque / DD / Online Transfer in favour of
                        <b> Bangladesh Industrial Technical Assistance Centre</b>.<br />
                        Bank: <b>Sonali Bank Ltd, Tejgaon Branch</b> · A/C: <b>0000-0000-0000</b><br />
                        Quote invoice number <b className="font-mono">{invoice.invoice_number}</b> in the payment reference.
                    </p>
                </div>
            )}

            <PdfPopupModal
                open={showPdf}
                pdfUrl={showPdf ? `/customer/invoices/${invoice.id}/pdf` : null}
                title={`Invoice ${invoice.invoice_number}`}
                subtitle={`Job #${invoice.job_number ?? '—'}`}
                onClose={() => setShowPdf(false)}
            />
        </CustomerLayout>
    );
}
