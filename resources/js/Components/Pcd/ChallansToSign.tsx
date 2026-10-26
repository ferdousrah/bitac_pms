import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';

export interface ChallanToSign {
    id: number;
    challan_number: string;
    type: 'full' | 'partial';
    job_number: string | number | null;
    wo_number: string | null;
    customer: string | null;
    quantity: number;
    ordered: number;
    lines: { description: string; quantity: number; unit: string | null }[];
    vehicle: string | null;
    raised_by: string | null;
    raised_at: string | null;
    waiting_days: number | null;
    pdf_url: string;
}

/**
 * Delivery challans waiting for PCD's নির্বাহী প্রকৌশলী (BITAC, 2026-10-27).
 * Signing puts his signature on the challan, lets the delivery be confirmed
 * and shows it to Billing & Accounts; rejecting cancels the delivery.
 */
export default function ChallansToSign({ challans }: { challans: ChallanToSign[] }) {
    const mySignatures = (usePage().props as any)?.auth?.user?.signatures ?? [];
    const sigRef = useRef<SignaturePickerHandle>(null);
    const [pdf, setPdf] = useState<ChallanToSign | null>(null);
    const [signing, setSigning] = useState<ChallanToSign | null>(null);
    const [rejecting, setRejecting] = useState<ChallanToSign | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const sign = () => {
        if (!signing) return;
        const choice = sigRef.current?.value();
        setBusy(true);
        router.post(`/pcd/inbox/challans/${signing.id}/approve`, {
            signature: choice?.drawn ?? null,
            user_signature_id: choice?.userSignatureId ?? null,
        }, { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setSigning(null) });
    };

    const reject = () => {
        if (!rejecting || reason.trim().length < 3) return;
        setBusy(true);
        router.post(`/pcd/inbox/challans/${rejecting.id}/reject`, { reason }, {
            preserveScroll: true, onFinish: () => setBusy(false),
            onSuccess: () => { setRejecting(null); setReason(''); },
        });
    };

    if (challans.length === 0) return null;

    return (
        <div id="challans" className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden scroll-mt-24">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <i className="fi fi-rr-file-signature text-sm leading-none" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-emerald-900 leading-tight">Delivery challans to sign</h3>
                        <p className="text-[11px] text-emerald-700/70 leading-tight mt-0.5">
                            Your signature goes on the challan — then the goods can go, and Billing & Accounts sees it.
                        </p>
                    </div>
                </div>
                <span className="min-w-[28px] h-7 px-2 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-extrabold flex items-center justify-center">
                    {challans.length}
                </span>
            </div>

            <div className="divide-y divide-surface-100">
                {challans.map(c => (
                    <div key={c.id} className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold text-surface-900">{c.challan_number}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${c.type === 'partial'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {c.type === 'partial' ? 'Partial' : 'Full'}
                                </span>
                                {(c.waiting_days ?? 0) >= 1 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200">
                                        {c.waiting_days}d waiting
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-semibold text-surface-900 mt-0.5">{c.customer ?? '—'}</p>
                            <p className="text-[11px] text-surface-500">
                                Job #{c.job_number ?? '—'} · {c.wo_number} · {c.quantity} of {c.ordered} pcs
                                {c.vehicle ? ` · ${c.vehicle}` : ''}
                            </p>
                            {c.lines.length > 0 && (
                                <p className="text-[11px] text-surface-600 mt-0.5 truncate">
                                    {c.lines.map(l => `${l.description} × ${l.quantity}${l.unit ? ' ' + l.unit : ''}`).join(' · ')}
                                </p>
                            )}
                            <p className="text-[11px] text-surface-400 mt-0.5">Raised by {c.raised_by ?? '—'} · {c.raised_at}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setPdf(c)} className="btn-outline btn-sm">
                                <i className="fi fi-rr-document text-xs leading-none" /> Challan
                            </button>
                            <button type="button" onClick={() => { setRejecting(c); setReason(''); }} className="btn-ghost btn-sm text-rose-600">
                                Reject
                            </button>
                            <button type="button" onClick={() => setSigning(c)} className="btn-primary btn-sm">
                                <i className="fi fi-rr-signature text-xs leading-none" /> Sign
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.pdf_url ?? null}
                title={pdf?.challan_number} subtitle={pdf?.customer ?? undefined} onClose={() => setPdf(null)} />

            {signing && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !busy && setSigning(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Sign challan {signing.challan_number}</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                Your signature prints over "Executive Engineer, Production Control Division" on the challan.
                            </p>
                        </div>
                        <div className="p-5">
                            <SignaturePicker ref={sigRef} signatures={mySignatures} padHeight={110} />
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setSigning(null)} disabled={busy} className="btn-ghost">Cancel</button>
                            <button type="button" onClick={sign} disabled={busy} className="btn-primary">
                                {busy ? 'Signing…' : <><i className="fi fi-rr-check text-xs leading-none" /> Sign challan</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rejecting && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !busy && setRejecting(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Reject challan {rejecting.challan_number}</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                The delivery is cancelled and its quantities freed — PCD raises a corrected one.
                            </p>
                        </div>
                        <div className="p-5">
                            <label className="form-label">Reason <span className="text-red-500">*</span></label>
                            <textarea className="form-textarea" rows={3} value={reason} autoFocus
                                onChange={e => setReason(e.target.value)} placeholder="What is wrong with it?" />
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setRejecting(null)} disabled={busy} className="btn-ghost">Cancel</button>
                            <button type="button" onClick={reject} disabled={busy || reason.trim().length < 3}
                                className="btn-primary !bg-rose-600 hover:!bg-rose-700">
                                {busy ? 'Rejecting…' : 'Reject & cancel delivery'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
