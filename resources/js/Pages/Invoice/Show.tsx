import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { useState } from 'react';

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    issued: 'badge-blue',
    sent: 'badge-blue',
    acknowledged: 'badge-blue',
    paid: 'badge-green',
    overdue: 'badge-red',
};

const paymentMethodLabel: Record<string, string> = {
    cash: 'Cash',
    cheque: 'Cheque',
    bank_transfer: 'Bank Transfer',
    online: 'Online / Mobile Banking',
    other: 'Other',
};

const formatAmount = (amount: any, fraction = 2) =>
    `৳${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: fraction })}`;

export default function InvoiceShow({ invoice }: any) {
    const { post, processing } = useForm({});
    const [showPay, setShowPay] = useState(false);

    const payForm = useForm({
        paid_amount: invoice.total_amount,
        payment_method: 'bank_transfer' as 'cash' | 'cheque' | 'bank_transfer' | 'online' | 'other',
        payment_reference: '',
        paid_at: new Date().toISOString().slice(0, 10),
        payment_notes: '',
    });

    const submitPay = () => {
        payForm.post(`/invoices/${invoice.id}/mark-paid`, {
            onSuccess: () => setShowPay(false),
        });
    };

    const isPaid = invoice.status === 'paid';

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
                                    Job #<span className="font-bold text-surface-700">{invoice.job_number ?? '—'}</span>
                                    <span className="mx-1.5 text-surface-300">·</span>
                                    <Link href={`/work-orders/${invoice.work_order_id}`} className="font-mono text-brand-600 hover:underline">
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
                                        <dd className="text-surface-900">{invoice.issued_date ?? '--'}</dd>
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

                {/* Paid receipt banner */}
                {isPaid && (
                    <div className="card border-emerald-300 overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="fi fi-rr-badge-check text-base leading-none" />
                                <span className="text-sm font-bold uppercase tracking-wider">Payment Received</span>
                            </div>
                            <span className="text-[11px] text-white/90">{invoice.paid_at}</span>
                        </div>
                        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Amount Received</div>
                                <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">{formatAmount(invoice.paid_amount)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Method</div>
                                <div className="text-sm font-semibold text-surface-900 mt-0.5">
                                    {paymentMethodLabel[invoice.payment_method] ?? invoice.payment_method ?? '—'}
                                </div>
                            </div>
                            {invoice.payment_reference && (
                                <div>
                                    <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Reference</div>
                                    <div className="text-sm font-mono text-surface-800 mt-0.5">{invoice.payment_reference}</div>
                                </div>
                            )}
                            {invoice.marked_paid_by && (
                                <div>
                                    <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Recorded By</div>
                                    <div className="text-sm text-surface-800 mt-0.5">{invoice.marked_paid_by}</div>
                                </div>
                            )}
                            {invoice.payment_notes && (
                                <div className="sm:col-span-2">
                                    <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Notes</div>
                                    <div className="text-sm text-surface-800 mt-0.5 whitespace-pre-line">{invoice.payment_notes}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                                <span className="text-surface-600">VAT ({invoice.vat_rate ?? 15}%)</span>
                                <span className="font-mono text-surface-900">
                                    {formatAmount(invoice.vat_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-surface-100">
                                <span className="text-surface-600">Tax ({invoice.tax_rate ?? 0}%)</span>
                                <span className="font-mono text-surface-900">
                                    {formatAmount(invoice.tax_amount ?? 0)}
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
                        View PDF
                    </a>
                    {!isPaid && (
                        <button
                            onClick={() => setShowPay(true)}
                            className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700"
                        >
                            <i className="fi fi-rr-badge-check text-xs leading-none" />
                            Mark as Paid
                        </button>
                    )}
                    {invoice.status === 'sent' && (
                        <button
                            onClick={() => post(`/invoices/${invoice.id}/acknowledge`)}
                            disabled={processing}
                            className="btn-outline btn-sm"
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

            {/* Mark-as-paid modal */}
            {showPay && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => !payForm.processing && setShowPay(false)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-surface-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <i className="fi fi-rr-badge-check text-base" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">Record Payment</h3>
                                    <p className="text-xs text-surface-500">{invoice.invoice_number} · {invoice.customer}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="form-group">
                                    <label className="form-label">Amount Received <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={payForm.data.paid_amount}
                                        onChange={(e) => payForm.setData('paid_amount', e.target.value as any)}
                                        className="form-input font-mono"
                                    />
                                    {payForm.errors.paid_amount && <p className="form-error">{payForm.errors.paid_amount}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Payment Date <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        value={payForm.data.paid_at}
                                        onChange={(e) => payForm.setData('paid_at', e.target.value)}
                                        className="form-input"
                                    />
                                    {payForm.errors.paid_at && <p className="form-error">{payForm.errors.paid_at}</p>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Payment Method <span className="text-red-500">*</span></label>
                                <select
                                    value={payForm.data.payment_method}
                                    onChange={(e) => payForm.setData('payment_method', e.target.value as any)}
                                    className="form-select"
                                >
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="online">Online / Mobile Banking</option>
                                    <option value="cash">Cash</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Reference <span className="form-label-optional">Cheque No / Transaction ID</span>
                                </label>
                                <input
                                    type="text"
                                    value={payForm.data.payment_reference}
                                    onChange={(e) => payForm.setData('payment_reference', e.target.value)}
                                    className="form-input font-mono"
                                    placeholder="e.g. CHQ-987654 or TX-2026-9182734"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes <span className="form-label-optional">optional</span></label>
                                <textarea
                                    value={payForm.data.payment_notes}
                                    onChange={(e) => payForm.setData('payment_notes', e.target.value)}
                                    rows={3}
                                    className="form-input"
                                    style={{ resize: 'vertical' }}
                                    placeholder="Bank name, branch, payer reference, etc."
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2 rounded-b-2xl">
                            <button type="button" onClick={() => setShowPay(false)} disabled={payForm.processing} className="btn-outline">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitPay}
                                disabled={payForm.processing || !payForm.data.paid_amount}
                                className="btn bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {payForm.processing ? (
                                    <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving...</>
                                ) : (
                                    <><i className="fi fi-rr-badge-check text-sm" /> Mark Paid</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
