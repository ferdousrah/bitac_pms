import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    sent: 'badge-blue',
    acknowledged: 'badge-blue',
    paid: 'badge-green',
    overdue: 'badge-red',
};

const formatAmount = (amount: any, fraction = 2) =>
    `৳${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: fraction })}`;

export default function InvoiceShow({ invoice }: any) {
    const { post, processing } = useForm({});

    return (
        <AppLayout header={`Invoice — ${invoice.invoice_number}`}>
            <div className="max-w-4xl animate-fade-in space-y-6">
                {/* Invoice Header Card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">
                                    Invoice
                                </div>
                                <h2 className="text-xl font-bold font-mono text-surface-900 mt-1">
                                    {invoice.invoice_number}
                                </h2>
                                <p className="text-surface-600 text-sm mt-1">{invoice.customer}</p>
                                <p className="text-surface-400 text-xs mt-0.5">
                                    Work Order:{' '}
                                    <Link
                                        href={`/work-orders/${invoice.work_order_id}`}
                                        className="font-mono text-brand-600 hover:underline"
                                    >
                                        {invoice.wo_number}
                                    </Link>
                                </p>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-2xl font-bold font-mono text-surface-900">
                                    {formatAmount(invoice.total_amount, 2)}
                                </div>
                                <span className={`badge mt-2 ${statusBadge[invoice.status] ?? 'badge-slate'}`}>
                                    {invoice.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-surface-100">
                            <div>
                                <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2 tracking-wide">
                                    Bill To
                                </h4>
                                <p className="text-sm font-semibold text-surface-900">{invoice.customer}</p>
                                {invoice.customer_address && (
                                    <p className="text-sm text-surface-600 mt-1">{invoice.customer_address}</p>
                                )}
                            </div>
                            <div className="sm:text-right">
                                <h4 className="text-xs font-semibold text-surface-400 uppercase mb-2 tracking-wide">
                                    Dates
                                </h4>
                                <dl className="space-y-1 text-sm">
                                    <div className="flex justify-between sm:justify-end gap-6">
                                        <dt className="text-surface-500">Issued:</dt>
                                        <dd className="text-surface-900">{invoice.issued_date}</dd>
                                    </div>
                                    <div className="flex justify-between sm:justify-end gap-6">
                                        <dt className="text-surface-500">Due:</dt>
                                        <dd className="text-surface-900">{invoice.due_date ?? '--'}</dd>
                                    </div>
                                    {invoice.payment_terms && (
                                        <div className="flex justify-between sm:justify-end gap-6">
                                            <dt className="text-surface-500">Terms:</dt>
                                            <dd className="text-surface-900">{invoice.payment_terms}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Amount Breakdown */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-base font-bold text-surface-900">Amount Details</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between py-2 border-b border-surface-100">
                                <span className="text-surface-600">Subtotal</span>
                                <span className="font-mono text-surface-900">
                                    {formatAmount(invoice.subtotal)}
                                </span>
                            </div>
                            {Number(invoice.discount) > 0 && (
                                <div className="flex justify-between py-2 border-b border-surface-100 text-red-600">
                                    <span>Discount</span>
                                    <span className="font-mono">- {formatAmount(invoice.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-2 border-b border-surface-100">
                                <span className="text-surface-600">VAT ({invoice.vat_rate}%)</span>
                                <span className="font-mono text-surface-900">
                                    {formatAmount(invoice.vat_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between py-3 mt-1 font-bold text-base border-t-2 border-surface-200">
                                <span className="text-surface-900">Total</span>
                                <span className="font-mono text-surface-900">
                                    {formatAmount(invoice.total_amount)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    <a
                        href={`/invoices/${invoice.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-danger btn-sm"
                    >
                        <i className="fi fi-rr-file-pdf text-xs leading-none" />
                        Download PDF
                    </a>
                    {invoice.status === 'sent' && (
                        <button
                            onClick={() => post(`/invoices/${invoice.id}/acknowledge`)}
                            disabled={processing}
                            className="btn-primary btn-sm"
                        >
                            <i className="fi fi-rr-check text-xs leading-none" />
                            Mark Acknowledged
                        </button>
                    )}
                    <Link href="/invoices" className="btn-outline btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" />
                        Back
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
