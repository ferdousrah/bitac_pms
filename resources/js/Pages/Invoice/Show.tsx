import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import RichTextEditor from '@/Components/RichTextEditor';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';

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

export default function InvoiceShow({ invoice, canSign = false }: any) {
    const [pdf, setPdf] = useState<string | null>(null);
    const [showMail, setShowMail] = useState(false);
    const mail = useForm<any>({
        to: invoice.customer_email ?? '',
        cc: '',
        subject: `Bill ${invoice.invoice_number} — BITAC`,
        message: '',
        from_email: '',
        lang: 'bn',
        include_letter: true,
        include_musak: true,
    });
    const sendMail = (e: FormEvent) => {
        e.preventDefault();
        mail.post(`/invoices/${invoice.id}/email`, { onSuccess: () => setShowMail(false) });
    };
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

    // The Accounts Officer signs the bill itself — their own saved blocks,
    // default preselected. Separate from signing the forwarding letter.
    const mySignatures = (usePage().props as any)?.auth?.user?.signatures ?? [];
    const sigRef = useRef<SignaturePickerHandle>(null);
    const [showSign, setShowSign] = useState(false);
    const [signing, setSigning] = useState(false);

    const doSign = () => {
        setSigning(true);
        const choice = sigRef.current?.value();
        router.post(`/invoices/${invoice.id}/sign`, {
            signature: choice?.drawn ?? null,
            user_signature_id: choice?.userSignatureId ?? null,
        }, {
            preserveScroll: true,
            onFinish: () => setSigning(false),
            onSuccess: () => setShowSign(false),
        });
    };

    const removeSignature = () => {
        if (!confirm('Remove the signature from this bill?')) return;
        router.delete(`/invoices/${invoice.id}/sign`, { preserveScroll: true });
    };

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
                    {canSign && !invoice.signed && (
                        <button
                            type="button"
                            onClick={() => setShowSign(true)}
                            className="btn-primary btn-sm"
                        >
                            <i className="fi fi-rr-signature text-xs leading-none" />
                            Sign Document
                        </button>
                    )}
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
                    <Link href={`/invoices/${invoice.id}/letter`} className="btn-outline btn-sm">
                        <i className="fi fi-rr-envelope text-xs leading-none" />
                        {invoice.has_letter ? 'Forwarding Letter' : 'Write Forwarding Letter'}
                    </Link>
                    {invoice.musak_challan ? (
                        <Link href={`/musak-challans/${invoice.musak_challan.id}/edit`} className="btn-outline btn-sm">
                            <i className="fi fi-rr-file-invoice text-xs leading-none" />
                            মূসক ৬.৩
                        </Link>
                    ) : (
                        <Link href={`/musak-challans/create?invoice=${invoice.id}`} className="btn-outline btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" />
                            মূসক ৬.৩
                        </Link>
                    )}
                    <button type="button" onClick={() => setShowMail(true)} className="btn-primary btn-sm">
                        <i className="fi fi-rr-paper-plane text-xs leading-none" />
                        Send to customer
                    </button>
                    <Link href="/invoices" className="btn-outline btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" />
                        Back
                    </Link>
                </div>

                {/* Signed by the accounts desk — what prints over the
                    Accounts Officer rule on the bill. */}
                {invoice.signed && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-badge-check text-sm leading-none" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-emerald-900">
                                    Signed by {invoice.signed_by ?? 'the accounts desk'}
                                </p>
                                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                                    {invoice.signed_at ?? ''} · this signature prints on the bill.
                                </p>
                                {invoice.signature_url && (
                                    <img src={invoice.signature_url} alt="Signature"
                                        className="mt-2 max-h-24 bg-white rounded-lg border border-emerald-100 p-1.5" />
                                )}
                            </div>
                        </div>
                        {canSign && (
                            <div className="flex flex-col gap-2 shrink-0">
                                <button type="button" onClick={() => setShowSign(true)} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-signature text-xs leading-none" /> Re-sign
                                </button>
                                <button type="button" onClick={removeSignature} className="btn-ghost btn-sm text-red-600">
                                    <i className="fi fi-rr-trash text-xs leading-none" /> Remove
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* What travels with this bill. */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Documents that travel together</h3>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="p-3 rounded-xl border border-surface-200">
                            <p className="font-semibold text-surface-900">Forwarding letter</p>
                            {invoice.has_letter ? (
                                <>
                                    <p className="text-xs text-surface-500 mt-0.5">
                                        {invoice.letter_subject || 'Written'}
                                        {invoice.letter_issued_at ? ` · ${invoice.letter_issued_at}` : ''}
                                    </p>
                                    <div className="flex gap-1.5 mt-2">
                                        <button type="button"
                                            onClick={() => setPdf(`/invoices/${invoice.id}/letter/pdf?preview=base64&lang=bn`)}
                                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">বাংলা</button>
                                        <button type="button"
                                            onClick={() => setPdf(`/invoices/${invoice.id}/letter/pdf?preview=base64&lang=en`)}
                                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">EN</button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-surface-400 mt-0.5">Not written yet.</p>
                            )}
                        </div>
                        <div className="p-3 rounded-xl border border-surface-200">
                            <p className="font-semibold text-surface-900">Bill</p>
                            <p className="text-xs text-surface-500 mt-0.5">{invoice.invoice_number}</p>
                            <button type="button"
                                onClick={() => setPdf(`/invoices/${invoice.id}/pdf?preview=base64`)}
                                className="mt-2 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">PDF</button>
                        </div>
                        <div className="p-3 rounded-xl border border-surface-200">
                            <p className="font-semibold text-surface-900">মূসক ৬.৩</p>
                            {invoice.musak_challan ? (
                                <>
                                    <p className="text-xs text-surface-500 mt-0.5">নং {invoice.musak_challan.challan_no}</p>
                                    <button type="button"
                                        onClick={() => setPdf(`/musak-challans/${invoice.musak_challan.id}/pdf?preview=base64&copy=1`)}
                                        className="mt-2 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">প্রথম কপি</button>
                                </>
                            ) : (
                                <p className="text-xs text-surface-400 mt-0.5">Not raised yet.</p>
                            )}
                        </div>
                    </div>
                    {invoice.emailed_at && (
                        <div className="px-5 pb-4 text-xs text-surface-400">Last sent {invoice.emailed_at}</div>
                    )}
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

            {/* Send the three that travel together. */}
            {showMail && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMail(false)} />
                    <form onSubmit={sendMail}
                        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-surface-900">Send bill {invoice.invoice_number}</h3>
                            <button type="button" onClick={() => setShowMail(false)}
                                className="w-8 h-8 rounded-lg hover:bg-surface-100 flex items-center justify-center">
                                <i className="fi fi-rr-cross text-sm leading-none" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">To <span className="text-red-500">*</span></label>
                                    <input type="email" className="form-input" value={mail.data.to}
                                        onChange={(e) => mail.setData('to', e.target.value)} />
                                    {mail.errors.to && <p className="form-error">{mail.errors.to as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">CC <span className="form-label-optional">Optional</span></label>
                                    <input className="form-input" value={mail.data.cc}
                                        onChange={(e) => mail.setData('cc', e.target.value)}
                                        placeholder="comma separated" />
                                </div>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Subject <span className="text-red-500">*</span></label>
                                <input className="form-input" value={mail.data.subject}
                                    onChange={(e) => mail.setData('subject', e.target.value)} />
                                {mail.errors.subject && <p className="form-error">{mail.errors.subject as any}</p>}
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Message</label>
                                <RichTextEditor value={mail.data.message} minHeight="140px"
                                    onChange={(v: string) => mail.setData('message', v)} />
                            </div>

                            <div className="rounded-xl border border-surface-200 p-3 space-y-2">
                                <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Attachments</p>
                                <label className={`flex items-center gap-2 text-sm ${invoice.has_letter ? 'text-surface-700 cursor-pointer' : 'text-surface-400'}`}>
                                    <input type="checkbox" disabled={!invoice.has_letter}
                                        checked={invoice.has_letter && mail.data.include_letter}
                                        onChange={(e) => mail.setData('include_letter', e.target.checked)}
                                        className="rounded border-surface-300" />
                                    Forwarding letter {invoice.has_letter ? '' : '— none written yet'}
                                </label>
                                <label className="flex items-center gap-2 text-sm text-surface-500">
                                    <input type="checkbox" checked readOnly className="rounded border-surface-300" />
                                    Bill {invoice.invoice_number} (always sent)
                                </label>
                                <label className={`flex items-center gap-2 text-sm ${invoice.musak_challan ? 'text-surface-700 cursor-pointer' : 'text-surface-400'}`}>
                                    <input type="checkbox" disabled={!invoice.musak_challan}
                                        checked={!!invoice.musak_challan && mail.data.include_musak}
                                        onChange={(e) => mail.setData('include_musak', e.target.checked)}
                                        className="rounded border-surface-300" />
                                    মূসক ৬.৩ {invoice.musak_challan ? `— নং ${invoice.musak_challan.challan_no}` : '— not raised yet'}
                                </label>
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-xs text-surface-500">Letter language</span>
                                    <div className="flex rounded-lg border border-surface-200 overflow-hidden text-xs font-bold">
                                        {(['bn', 'en'] as const).map((l) => (
                                            <button key={l} type="button" onClick={() => mail.setData('lang', l)}
                                                className={`px-2.5 py-1 ${mail.data.lang === l ? 'bg-brand-500 text-white' : 'text-surface-500 hover:bg-surface-50'}`}>
                                                {l === 'bn' ? 'বাংলা' : 'EN'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowMail(false)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={mail.processing} className="btn-primary">
                                {mail.processing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Sending…</>
                                    : <><i className="fi fi-rr-paper-plane text-xs leading-none" /> Send</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sign the bill */}
            {showSign && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => !signing && setShowSign(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                                <i className="fi fi-rr-signature text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">
                                    Sign {invoice.invoice_number}
                                </h3>
                                <p className="text-[11px] text-surface-500 leading-tight mt-0.5">
                                    Your signature prints over the Accounts Officer line on the bill.
                                </p>
                            </div>
                        </div>
                        <div className="p-5">
                            <SignaturePicker ref={sigRef} signatures={mySignatures} padHeight={110} />
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowSign(false)} disabled={signing}
                                className="btn-ghost">Cancel</button>
                            <button type="button" onClick={doSign} disabled={signing} className="btn-primary">
                                {signing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Signing…</>
                                    : <><i className="fi fi-rr-check text-xs leading-none" /> Sign Document</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf} title={invoice.invoice_number}
                onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
