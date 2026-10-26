import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

interface Receipt {
    link: string | null;
    qr_svg: string | null;
    expires_at: string | null;
    signed: {
        type: 'signature' | 'photo'; name: string; designation: string | null; phone: string | null;
        at: string | null; url: string | null;
    } | null;
}

/**
 * Confirm a delivery — the receiver signs for the goods one of two ways
 * (BITAC, 2026-10-27): on his own phone / BITAC's tablet through a one-time
 * link (QR code), or by pen on the paper challan, photographed here.
 */
export default function DeliveryComplete({ delivery, receipt, receiptBlocker }: { delivery: any; receipt: Receipt; receiptBlocker: string | null }) {
    const [challanOpen, setChallanOpen] = useState(false);
    const [mode, setMode] = useState<'link' | 'photo'>(receipt?.signed?.type === 'photo' ? 'photo' : 'link');
    const [copied, setCopied] = useState(false);
    const signedOnLink = receipt?.signed?.type === 'signature';
    const delivered = delivery.status === 'delivered';
    const open = !receiptBlocker;   // challan signed by the XEN, still on its way

    // While the link is out and nobody has signed, look for the signature.
    useEffect(() => {
        if (!open || mode !== 'link' || !receipt?.link || signedOnLink) return;
        const t = window.setInterval(() => {
            if (document.visibilityState === 'visible') router.reload({ only: ['receipt'] });
        }, 4000);
        return () => window.clearInterval(t);
    }, [open, mode, receipt?.link, signedOnLink]);

    const linkForm = useForm({ mode: 'link', notes: '' });
    const photoForm = useForm({
        mode: 'photo',
        received_by: '', receiver_designation: '', receiver_phone: '',
        received_at: new Date().toISOString().slice(0, 16),
        photo: null as File | null,
        notes: '',
    });

    const makeLink = () => router.post(`/delivery/${delivery.id}/receipt-link`, {}, { preserveScroll: true });
    const newLink = () => {
        if (confirm('Send a new link? The signature collected on the old one will be discarded.')) makeLink();
    };
    const copy = async () => {
        if (!receipt?.link) return;
        try { await navigator.clipboard.writeText(receipt.link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
    };
    const whatsapp = receipt?.link
        ? `https://wa.me/?text=${encodeURIComponent(`BITAC delivery challan ${delivery.challan_number} — please sign for the goods: ${receipt.link}`)}`
        : '#';

    const confirmLink = (e: FormEvent) => { e.preventDefault(); linkForm.post(`/delivery/${delivery.id}/complete`); };
    const confirmPhoto = (e: FormEvent) => {
        e.preventDefault();
        photoForm.post(`/delivery/${delivery.id}/complete`, { forceFormData: true });
    };

    return (
        <AppLayout header={`Complete Delivery — ${delivery.challan_number}`}>
            <div className="max-w-3xl animate-fade-in space-y-6">
                {/* Summary */}
                <div className="alert alert-info">
                    <i className="fi fi-rr-info text-sm leading-none" />
                    <div>
                        <div className="font-semibold">
                            {delivery.wo_number} — {delivery.product} × {delivery.quantity_delivered} units
                        </div>
                        <div className="text-xs opacity-80 mt-0.5">Customer: {delivery.customer}</div>
                    </div>
                    <button type="button" onClick={() => setChallanOpen(true)}
                        className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors">
                        <i className="fi fi-rr-file-pdf text-sm leading-none" /> Challan PDF
                    </button>
                </div>

                <PdfPopupModal
                    open={challanOpen}
                    pdfUrl={challanOpen ? `/delivery/${delivery.id}/pdf?preview=base64` : null}
                    title={`Challan ${delivery.challan_number}`}
                    subtitle={delivery.wo_number}
                    onClose={() => setChallanOpen(false)}
                />

                {/* The XEN signs the challan before the goods go (2026-10-27). */}
                {delivery.challan_status === 'pending' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <b>Waiting for the নির্বাহী প্রকৌশলী (PCD) to sign this challan.</b> The delivery can be confirmed once he
                        has — he has been notified.
                    </div>
                )}
                {delivery.challan_status === 'rejected' && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        <b>The challan was rejected and this delivery cancelled.</b>
                        {delivery.challan_rejection && <> Reason: {delivery.challan_rejection}</>} Raise a new delivery with the corrections.
                    </div>
                )}
                {delivery.challan_status === 'approved' && delivery.challan_signed_by && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                        <i className="fi fi-rr-badge-check mr-1.5" />Challan signed by <b>{delivery.challan_signed_by}</b> on {delivery.challan_signed_at}.
                    </div>
                )}

                {delivered && receipt?.signed && (
                    <div className="card">
                        <div className="card-body flex items-center gap-4">
                            {receipt.signed.type === 'signature' && receipt.signed.url && (
                                <img src={receipt.signed.url} alt="" className="h-16 w-auto bg-surface-50 rounded-lg border border-surface-200 p-1" />
                            )}
                            <div className="text-sm text-surface-700">
                                <b>Delivered.</b> Received by <b>{receipt.signed.name}</b>
                                {receipt.signed.designation && <>, {receipt.signed.designation}</>}
                                {receipt.signed.phone && <> · {receipt.signed.phone}</>} on {receipt.signed.at}.
                                {receipt.signed.type === 'photo' && receipt.signed.url && (
                                    <> <a href={receipt.signed.url} target="_blank" rel="noopener" className="text-brand-600 font-semibold">Signed challan photo</a></>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {open && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Receiver's signature</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                The person the client sent signs for the goods — it prints in "Signature of receiver" on the challan.
                            </p>
                        </div>
                        <div className="card-body space-y-5">
                            {/* Two ways — one trough, one raised pill. */}
                            <div className="inline-flex p-1 rounded-xl bg-surface-100 gap-1 w-full sm:w-auto">
                                {([['link', 'fi-rr-mobile-notch', 'Sign on phone / tablet'], ['photo', 'fi-rr-camera', 'Photo of signed challan']] as const).map(([k, icon, label]) => (
                                    <button key={k} type="button" onClick={() => setMode(k)}
                                        className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition
                                            ${mode === k ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                                        <i className={`fi ${icon} text-xs leading-none`} /> {label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'link' && (
                                signedOnLink && receipt.signed ? (
                                    <form onSubmit={confirmLink} className="space-y-4">
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                            {receipt.signed.url && (
                                                <img src={receipt.signed.url} alt="Receiver's signature"
                                                    className="h-20 w-auto max-w-full bg-white rounded-lg border border-emerald-200 p-1" />
                                            )}
                                            <div className="text-sm">
                                                <div className="font-bold text-emerald-900"><i className="fi fi-rr-check mr-1" />Signed by {receipt.signed.name}</div>
                                                <div className="text-emerald-800/80">
                                                    {receipt.signed.designation || '—'} · {receipt.signed.phone || '—'} · {receipt.signed.at}
                                                </div>
                                                <button type="button" onClick={newLink} className="text-xs font-semibold text-surface-500 hover:text-surface-700 mt-1">
                                                    Wrong person? Send a new link
                                                </button>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label-optional">Notes</label>
                                            <textarea rows={2} className="form-textarea" value={linkForm.data.notes}
                                                onChange={e => linkForm.setData('notes', e.target.value)}
                                                placeholder="Any remarks on the condition of the goods…" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button type="submit" disabled={linkForm.processing} className="btn-success">
                                                <i className="fi fi-rr-check text-xs leading-none" /> {linkForm.processing ? 'Confirming…' : 'Confirm Delivery'}
                                            </button>
                                            <Link href="/delivery" className="btn-outline">Cancel</Link>
                                        </div>
                                    </form>
                                ) : receipt?.link ? (
                                    <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                                        {receipt.qr_svg && (
                                            <div className="shrink-0 rounded-2xl border border-surface-200 bg-white p-3"
                                                // Generated on the server from our own link.
                                                dangerouslySetInnerHTML={{ __html: receipt.qr_svg }} />
                                        )}
                                        <div className="flex-1 min-w-0 space-y-3 w-full">
                                            <div>
                                                <div className="text-sm font-bold text-surface-900">Let the receiver scan this with his phone camera</div>
                                                <p className="text-xs text-surface-500 mt-0.5">
                                                    He types his name, designation and mobile, and signs with his finger. On a BITAC tablet,
                                                    just open the link. Valid until {receipt.expires_at}, once.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input readOnly value={receipt.link} className="form-input text-xs font-mono flex-1 min-w-0" onFocus={e => e.target.select()} />
                                                <button type="button" onClick={copy} className="btn-outline btn-sm shrink-0">{copied ? 'Copied' : 'Copy'}</button>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <a href={whatsapp} target="_blank" rel="noopener" className="btn-sm inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500">
                                                    <i className="fi fi-rr-share text-xs leading-none" /> Send on WhatsApp
                                                </a>
                                                <a href={receipt.link} target="_blank" rel="noopener" className="btn-ghost btn-sm">Open on this device</a>
                                                <button type="button" onClick={newLink} className="btn-ghost btn-sm text-surface-500">New link</button>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                Waiting for his signature — this page updates by itself.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                                            <i className="fi fi-rr-qrcode text-2xl leading-none" />
                                        </div>
                                        <p className="text-sm text-surface-600 mt-3 max-w-sm mx-auto">
                                            Make a one-time link. The receiver scans its QR code with his phone — or opens it on BITAC's tablet — and signs there.
                                        </p>
                                        <button type="button" onClick={makeLink} className="btn-primary mt-4">
                                            <i className="fi fi-rr-qrcode text-xs leading-none" /> Create signing link
                                        </button>
                                    </div>
                                )
                            )}

                            {mode === 'photo' && (
                                <form onSubmit={confirmPhoto} className="space-y-4">
                                    <p className="text-xs text-surface-500">
                                        Print the challan, let the receiver sign it with a pen, and upload a photo or scan of it.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Receiver's name *</label>
                                            <input className="form-input" value={photoForm.data.received_by} required
                                                onChange={e => photoForm.setData('received_by', e.target.value)} />
                                            {photoForm.errors.received_by && <p className="form-error">{photoForm.errors.received_by}</p>}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label-optional">Designation</label>
                                            <input className="form-input" value={photoForm.data.receiver_designation}
                                                onChange={e => photoForm.setData('receiver_designation', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label-optional">Mobile</label>
                                            <input className="form-input" type="tel" value={photoForm.data.receiver_phone}
                                                onChange={e => photoForm.setData('receiver_phone', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Received at *</label>
                                            <input type="datetime-local" className="form-input" value={photoForm.data.received_at} required
                                                onChange={e => photoForm.setData('received_at', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Signed challan — photo or scan *</label>
                                        <input type="file" accept="image/*,application/pdf" capture="environment" className="form-input"
                                            onChange={e => photoForm.setData('photo', e.target.files?.[0] ?? null)} />
                                        {photoForm.errors.photo && <p className="form-error">{photoForm.errors.photo}</p>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-optional">Notes</label>
                                        <textarea rows={2} className="form-textarea" value={photoForm.data.notes}
                                            onChange={e => photoForm.setData('notes', e.target.value)} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="submit" disabled={photoForm.processing || !photoForm.data.photo} className="btn-success disabled:opacity-50">
                                            <i className="fi fi-rr-check text-xs leading-none" /> {photoForm.processing ? 'Confirming…' : 'Confirm Delivery'}
                                        </button>
                                        <Link href="/delivery" className="btn-outline">Cancel</Link>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
