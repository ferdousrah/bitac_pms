import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import RichTextEditor from '@/Components/RichTextEditor';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';
import RecordPaymentModal from '@/Components/Payment/RecordPaymentModal';
import PaymentRows from '@/Components/Payment/PaymentRows';

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

export default function InvoiceShow({
    invoice, canSign = false, ledger, payments = [], advance,
    deductionTypes = [], methods = {}, suggestedNo = '', canPay = {},
}: any) {
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

    // Collections. ⚠️ A bill is never "marked paid" any more — its status is
    // derived from this ledger, so a one-shot button would be undone by the
    // next recalculation and could not express an advance, a part payment or
    // money the client deducted.
    const [showPayment, setShowPayment] = useState(false);
    const [releasing, setReleasing] = useState<any | null>(null);
    const applyForm = useForm<any>({ invoice_id: invoice.id, amount: '', notes: '' });
    const releaseForm = useForm<any>({
        paid_on: new Date().toISOString().slice(0, 10),
        method: 'bank_transfer',
        reference: '',
        notes: '',
    });

    const isPaid = invoice.status === 'paid';
    const due = Number(ledger?.due ?? 0);
    const heldLines = (payments as any[])
        .flatMap((p) => p.deductions.map((d: any) => ({ ...d, payment_no: p.payment_no })))
        .filter((d: any) => d.is_recoverable && !d.released);

    const applyAdvance = () => {
        applyForm.post('/payments/apply-advance', {
            preserveScroll: true,
            onSuccess: () => applyForm.setData('amount', ''),
        });
    };
    const submitRelease = (e: FormEvent) => {
        e.preventDefault();
        releaseForm.post(`/payments/release-security/${releasing.id}`, {
            preserveScroll: true,
            onSuccess: () => setReleasing(null),
        });
    };

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

                {/* ── Collections ───────────────────────────────────────
                    What was billed, what has actually been settled, and what
                    the client is still holding. Security withheld is a DUE,
                    not a payment — see App\Services\PaymentLedger. */}
                <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                <i className="fi fi-rr-sack-dollar text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900 leading-tight">Payments</h3>
                                <p className="text-[11px] text-emerald-700/70 leading-tight mt-0.5">
                                    Advance, part payments and what the client deducted.
                                </p>
                            </div>
                        </div>
                        {canPay.record && due > 0.01 && (
                            <button type="button" onClick={() => setShowPayment(true)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors">
                                <i className="fi fi-rr-plus text-[11px] leading-none" /> Record Payment
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-surface-200 p-3">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Billed</p>
                                <p className="text-base font-bold font-mono text-surface-900 mt-1">{formatAmount(ledger?.billed ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border border-surface-200 p-3">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Settled</p>
                                <p className="text-base font-bold font-mono text-emerald-700 mt-1">{formatAmount(ledger?.settled ?? 0)}</p>
                                <p className="text-[10px] text-surface-400 mt-0.5">cash {formatAmount(ledger?.received ?? 0)}</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${(ledger?.security_held ?? 0) > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-surface-200'}`}>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Security held</p>
                                <p className={`text-base font-bold font-mono mt-1 ${(ledger?.security_held ?? 0) > 0 ? 'text-amber-700' : 'text-surface-400'}`}>
                                    {formatAmount(ledger?.security_held ?? 0)}
                                </p>
                                <p className="text-[10px] text-surface-400 mt-0.5">still owed to BITAC</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${due > 0.01 ? (invoice.is_overdue ? 'border-rose-200 bg-rose-50/60' : 'border-surface-200') : 'border-emerald-200 bg-emerald-50/60'}`}>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Due</p>
                                <p className={`text-base font-bold font-mono mt-1 ${due > 0.01 ? (invoice.is_overdue ? 'text-rose-700' : 'text-surface-900') : 'text-emerald-700'}`}>
                                    {formatAmount(due)}
                                </p>
                                <p className="text-[10px] text-surface-400 mt-0.5">
                                    {due <= 0.01 ? 'fully settled' : invoice.due_date ? `by ${invoice.due_date}` : ''}
                                    {due > 0.01 && invoice.is_overdue ? ' · overdue' : ''}
                                </p>
                            </div>
                        </div>

                        {/* An advance on this job that no bill has drawn on yet. */}
                        {canPay.record && (advance?.available ?? 0) > 0.01 && due > 0.01 && (
                            <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-sky-900">
                                            {formatAmount(advance.available)} advance in hand on this job
                                        </p>
                                        <p className="text-[11px] text-sky-700/80 mt-0.5">
                                            Applying it settles this bill without any new money arriving.
                                        </p>
                                    </div>
                                    <div className="flex items-end gap-2 ml-auto">
                                        <input type="number" step="0.01" min="0.01"
                                            className="form-input !py-1.5 w-32 text-right font-mono text-sm"
                                            placeholder={Math.min(advance.available, due).toFixed(2)}
                                            value={applyForm.data.amount}
                                            onChange={(e) => applyForm.setData('amount', e.target.value)} />
                                        <button type="button" onClick={applyAdvance}
                                            disabled={applyForm.processing || !applyForm.data.amount}
                                            className="btn-primary btn-sm bg-sky-600 hover:bg-sky-500 border-sky-600">
                                            Apply advance
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Retentions waiting to come back. */}
                        {heldLines.length > 0 && (
                            <div className="rounded-xl border border-amber-200 overflow-hidden">
                                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
                                    <p className="text-xs font-bold text-amber-900">Security held against this bill</p>
                                    <p className="text-[10px] text-amber-700/80 leading-tight">
                                        Recorded as deducted, not yet returned — it keeps the bill part-unsettled.
                                    </p>
                                </div>
                                <div className="divide-y divide-amber-100">
                                    {heldLines.map((d: any) => (
                                        <div key={d.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                                            <span className="min-w-0 truncate">
                                                <span className="font-semibold text-surface-800">{d.type}</span>
                                                <span className="text-[11px] text-surface-400"> · {d.payment_no}</span>
                                            </span>
                                            <span className="font-mono font-bold text-amber-700 shrink-0">{formatAmount(d.amount)}</span>
                                            {canPay.record && (
                                                <button type="button" onClick={() => setReleasing(d)} className="btn-outline btn-sm shrink-0">
                                                    Release
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <PaymentRows payments={payments} canDelete={canPay.delete} />
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
                    {canPay.record && !isPaid && (
                        <button
                            type="button"
                            onClick={() => setShowPayment(true)}
                            className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700"
                        >
                            <i className="fi fi-rr-sack-dollar text-xs leading-none" />
                            Record Payment
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

            <RecordPaymentModal
                open={showPayment}
                onClose={() => setShowPayment(false)}
                kind="against_bill"
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                dueAmount={due}
                deductionTypes={deductionTypes}
                methods={methods}
                suggestedNo={suggestedNo}
            />

            {/* Releasing one retention line. One at a time, because the
                release settles the bill that line was cut from. */}
            {releasing && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setReleasing(null)} />
                    <form onSubmit={submitRelease} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">
                                Release {formatAmount(releasing.amount)} — {releasing.type}
                            </h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                Deducted on {releasing.payment_no}. Releasing it settles that much of this bill.
                            </p>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Received on <span className="text-red-500">*</span></label>
                                    <input type="date" className="form-input" value={releaseForm.data.paid_on}
                                        onChange={(e) => releaseForm.setData('paid_on', e.target.value)} />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Method <span className="text-red-500">*</span></label>
                                    <select className="form-input" value={releaseForm.data.method}
                                        onChange={(e) => releaseForm.setData('method', e.target.value)}>
                                        {Object.entries(methods).map(([v, l]) => (
                                            <option key={v} value={v}>{l as string}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Reference <span className="form-label-optional">Optional</span></label>
                                <input className="form-input" value={releaseForm.data.reference}
                                    onChange={(e) => releaseForm.setData('reference', e.target.value)} />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Notes <span className="form-label-optional">Optional</span></label>
                                <textarea className="form-textarea" rows={2} value={releaseForm.data.notes}
                                    onChange={(e) => releaseForm.setData('notes', e.target.value)} />
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setReleasing(null)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={releaseForm.processing} className="btn-primary">
                                <i className="fi fi-rr-check text-xs leading-none" /> Record release
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf} title={invoice.invoice_number}
                onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
