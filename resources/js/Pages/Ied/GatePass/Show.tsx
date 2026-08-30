import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState, useRef } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';

interface Item {
    id: number;
    description: string;
    quantity: number;
    unit: string;
    condition_note: string | null;
}

interface Pass {
    id: number;
    pass_no: string;
    direction: 'in' | 'out';
    rfq_id: number | null;
    rfq_customer: string | null;
    rfq_customer_ref: string | null;
    pass_date: string | null;
    party_name: string | null;
    customer_rep_name: string | null;
    customer_rep_phone: string | null;
    customer_rep_id_number: string | null;
    vehicle_no: string | null;
    notes: string | null;
    status: 'draft' | 'pending_approval' | 'issued' | 'partially_returned' | 'completed' | 'cancelled' | 'rejected';
    issued_by: string | null;
    issued_at: string | null;
    completed_at: string | null;
    completed_by: string | null;
    completion_remarks: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
    cancellation_reason: string | null;
    items: Item[];
    pdf_url: string;
}

interface Props {
    pass: Pass;
}

const STATUS_LABEL: Record<string, string> = {
    issued: 'Issued', draft: 'Draft', pending_approval: 'Pending Approval',
    rejected: 'Rejected', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_CLS: Record<string, string> = {
    issued: 'badge-blue', completed: 'badge-green', cancelled: 'badge-red',
    pending_approval: 'badge-amber', rejected: 'badge-red', draft: 'badge-slate',
};

export default function GatePassShow({ pass, basePath = '/ied/gate-passes', canApprove = false, mySignatureUrl = null }: any) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const isIn = pass.direction === 'in';
    const isActive = pass.status === 'issued';

    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject]   = useState(false);
    const [reason, setReason]           = useState('');
    const [busy, setBusy]               = useState(false);

    // ── Recording goods going back ──
    // Whatever came in on a pass eventually leaves again (and the reverse),
    // usually a few pieces at a time, so returns are per item and partial.
    const canReturn = ['issued', 'partially_returned'].includes(pass.status);
    const [returnOpen, setReturnOpen] = useState(false);
    const [returnOn, setReturnOn] = useState(new Date().toISOString().slice(0, 10));
    const [returnNote, setReturnNote] = useState('');
    const [returnQty, setReturnQty] = useState<Record<number, string>>({});

    const submitReturn = () => {
        const items = pass.items
            .map((it: any) => ({ id: it.id, quantity: returnQty[it.id] ?? '' }))
            .filter((r: any) => Number(r.quantity) > 0);
        if (items.length === 0) return;
        setBusy(true);
        router.post(`${basePath}/${pass.id}/return`, { returned_on: returnOn, note: returnNote, items }, {
            preserveScroll: true,
            onFinish: () => setBusy(false),
            onSuccess: () => { setReturnOpen(false); setReturnQty({}); setReturnNote(''); },
        });
    };
    const sigRef = useRef<SignaturePadHandle>(null);
    const canAct = canApprove && pass.status === 'pending_approval';

    const doApprove = () => {
        setBusy(true);
        router.post(`${basePath}/${pass.id}/approve`, { signature: sigRef.current?.toDataURL() ?? null }, {
            preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setShowApprove(false),
        });
    };
    const doReject = () => {
        if (reason.trim().length < 3) return;
        setBusy(true);
        router.post(`${basePath}/${pass.id}/reject`, { rejection_reason: reason }, {
            preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setShowReject(false),
        });
    };

    const cancel = () => {
        const reason = prompt(`Cancel Gate Pass ${pass.pass_no}?\n\nOptional reason:`, '');
        if (reason === null) return; // Cancel button on prompt
        router.post(`${basePath}/${pass.id}/cancel`, { cancellation_reason: reason });
    };

    const complete = () => {
        const remarks = prompt(`Mark Gate Pass ${pass.pass_no} as completed?\n\nThis confirms the items have physically crossed the gate.\n\nOptional remarks:`, '');
        if (remarks === null) return;
        router.post(`${basePath}/${pass.id}/complete`, { completion_remarks: remarks });
    };

    return (
        <AppLayout header={`Gate Pass ${pass.pass_no}`}>
            <div className="max-w-4xl space-y-6 animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-start gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ${isIn ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                    <i className={`fi ${isIn ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt'} text-2xl leading-none`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-xl font-bold text-surface-900 font-mono">{pass.pass_no}</h1>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                                            isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            {isIn ? 'Gate Pass In' : 'Gate Pass Out'}
                                        </span>
                                        <span className={`badge ${STATUS_CLS[pass.status] ?? 'badge-slate'}`}>
                                            {STATUS_LABEL[pass.status] ?? pass.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-surface-600 mt-1">
                                        {pass.rfq_customer ?? '—'}
                                        {pass.rfq_id && <> · <Link href={`/rfqs/${pass.rfq_id}`} className="text-brand-600 hover:underline">RFQ #{pass.rfq_id}</Link></>}
                                    </p>
                                    <p className="text-xs text-surface-400 mt-1">Pass date {pass.pass_date} · issued by {pass.issued_by ?? '—'} on {pass.issued_at}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {canAct && (
                                    <>
                                        <button onClick={() => setShowApprove(true)} className="btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-600">
                                            <i className="fi fi-rr-check text-xs leading-none" /> Approve
                                        </button>
                                        <button onClick={() => { setReason(''); setShowReject(true); }} className="btn bg-rose-600 hover:bg-rose-700 text-white">
                                            <i className="fi fi-rr-cross-small text-sm leading-none" /> Reject
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setPdfOpen(true)}
                                    className="btn-primary"
                                >
                                    <i className="fi fi-rr-file-pdf text-xs leading-none" /> Print / Download PDF
                                </button>
                                <Link href={basePath} className="btn-ghost">Back</Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Representative info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Customer Representative</h3>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="sm:col-span-2">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Party Name</div>
                            <div className="text-surface-900 font-semibold">{pass.party_name ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Representative Name</div>
                            <div className="text-surface-900">{pass.customer_rep_name ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Phone</div>
                            <div className="text-surface-900">{pass.customer_rep_phone ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">NID / Employee ID</div>
                            <div className="text-surface-900 font-mono">{pass.customer_rep_id_number ?? '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Vehicle</div>
                            <div className="text-surface-900 font-mono">{pass.vehicle_no ?? '—'}</div>
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">
                            Items {isIn ? 'Entering BITAC' : 'Leaving BITAC'} ({pass.items.length})
                        </h3>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-surface-500 font-bold border-b border-surface-100">
                                    <th className="text-left px-4 py-2 w-10">#</th>
                                    <th className="text-left px-3 py-2">Description</th>
                                    <th className="text-right px-3 py-2 w-20">Qty</th>
                                    <th className="text-left px-3 py-2 w-16">Unit</th>
                                    <th className="text-right px-3 py-2 w-24">Returned</th>
                                    <th className="text-right px-3 py-2 w-24">Still out</th>
                                    <th className="text-left px-3 py-2">Condition</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-50">
                                {pass.items.map((it: any, idx: number) => (
                                    <tr key={it.id}>
                                        <td className="px-4 py-2 text-xs text-surface-400 font-mono align-top">{idx + 1}</td>
                                        <td className="px-3 py-2 text-surface-900 align-top whitespace-pre-line">{it.description}</td>
                                        <td className="px-3 py-2 text-right font-mono align-top">{it.quantity}</td>
                                        <td className="px-3 py-2 text-surface-700 align-top">{it.unit}</td>
                                        <td className="px-3 py-2 text-right font-mono align-top">
                                            {Number(it.returned_qty ?? 0) > 0
                                                ? <span className="text-emerald-700 font-semibold">{it.returned_qty}</span>
                                                : <span className="text-surface-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono align-top">
                                            {Number(it.outstanding ?? it.quantity) > 0
                                                ? <span className="text-amber-700 font-semibold">{it.outstanding ?? it.quantity}</span>
                                                : <span className="text-emerald-600 text-xs font-semibold">all back</span>}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-surface-600 align-top whitespace-pre-line">
                                            {it.condition_note ?? '—'}
                                            {/* Each return keeps its own note */}
                                            {(it.returns ?? []).length > 0 && (
                                                <ul className="mt-1.5 space-y-1">
                                                    {it.returns.map((r: any) => (
                                                        <li key={r.id} className="text-[11px] text-surface-500 flex items-start gap-1.5">
                                                            <i className="fi fi-rr-undo text-[9px] leading-none mt-1 text-emerald-500" />
                                                            <span>
                                                                <span className="font-semibold text-surface-700">{r.quantity} {it.unit}</span>
                                                                {' back on '}{r.returned_on}
                                                                {r.recorded_by && <span className="text-surface-400"> · {r.recorded_by}</span>}
                                                                {r.note && <span className="block italic text-surface-500">{r.note}</span>}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Record what has gone back */}
                {canReturn && (
                    <div className="card border-2 border-emerald-200 bg-emerald-50/20">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">
                                    {isIn ? 'Return goods to the party' : 'Record goods coming back'}
                                </h3>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    Item by item, and a few pieces at a time if that is how they go. The pass closes
                                    itself once everything is back.
                                </p>
                            </div>
                            {!returnOpen && (
                                <button type="button" onClick={() => setReturnOpen(true)} className="btn-primary btn-sm shrink-0">
                                    <i className="fi fi-rr-undo text-xs leading-none" /> Record Return
                                </button>
                            )}
                        </div>

                        {returnOpen && (
                            <div className="card-body space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="form-group !mb-0">
                                        <label className="form-label">Return date</label>
                                        <input type="date" value={returnOn} onChange={e => setReturnOn(e.target.value)} className="form-input" />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-surface-400 font-bold border-b border-surface-100">
                                                <th className="text-left px-2 py-2">Item</th>
                                                <th className="text-right px-2 py-2 w-24">Still out</th>
                                                <th className="text-right px-2 py-2 w-32">Returning now</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-50">
                                            {pass.items.map((it: any) => {
                                                const out = Number(it.outstanding ?? it.quantity);
                                                return (
                                                    <tr key={it.id}>
                                                        <td className="px-2 py-2 text-surface-800">{it.description}</td>
                                                        <td className="px-2 py-2 text-right font-mono text-surface-600">{out} {it.unit}</td>
                                                        <td className="px-2 py-2">
                                                            <input type="number" min="0" max={out} step="0.01"
                                                                disabled={out <= 0}
                                                                value={returnQty[it.id] ?? ''}
                                                                onChange={e => setReturnQty({ ...returnQty, [it.id]: e.target.value })}
                                                                placeholder={out <= 0 ? 'all back' : '0'}
                                                                className="form-input text-right font-mono !py-1.5 disabled:bg-surface-50" />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Note <span className="form-label-optional">(optional)</span></label>
                                    <textarea value={returnNote} onChange={e => setReturnNote(e.target.value)} rows={2}
                                        placeholder="Condition on return, who collected it, anything worth recording…"
                                        className="form-textarea" />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setReturnOpen(false)} disabled={busy} className="btn-ghost btn-sm">Cancel</button>
                                    <button type="button" onClick={submitReturn} disabled={busy} className="btn-primary btn-sm">
                                        <i className="fi fi-rr-undo text-xs leading-none" />
                                        {busy ? 'Saving…' : 'Save Return'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {pass.notes && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Notes</h3>
                        </div>
                        <div className="card-body">
                            <p className="text-sm text-surface-700 whitespace-pre-line">{pass.notes}</p>
                        </div>
                    </div>
                )}

                {isActive && (
                    <div className="card">
                        <div className="card-header">
                            <h4 className="text-sm font-bold text-surface-900">Pass actions</h4>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Mark completed once items have physically crossed the gate. Cancel if issued in error.
                            </p>
                        </div>
                        <div className="card-body flex flex-wrap items-center gap-2">
                            <button onClick={complete} className="btn-success btn-sm">
                                <i className="fi fi-rr-check-circle text-xs leading-none" /> Mark Completed
                            </button>
                            <button onClick={cancel} className="btn-danger btn-sm">
                                <i className="fi fi-rr-cross-circle text-xs leading-none" /> Cancel pass
                            </button>
                        </div>
                    </div>
                )}

                {/* Completion details — shown when status='completed' */}
                {pass.status === 'completed' && (
                    <div className="card border-emerald-200 bg-emerald-50/40">
                        <div className="card-body">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-check-circle text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-emerald-800">Pass Completed</h4>
                                    <p className="text-xs text-emerald-700/80 mt-0.5">
                                        Closed by {pass.completed_by ?? '—'} on {pass.completed_at}
                                    </p>
                                    {pass.completion_remarks && (
                                        <p className="text-xs text-surface-700 mt-2 whitespace-pre-line bg-white/60 border border-emerald-100 rounded-lg px-3 py-2">
                                            <span className="font-bold text-surface-500 text-[10px] uppercase tracking-wider block mb-0.5">Remarks</span>
                                            {pass.completion_remarks}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cancellation details — shown when status='cancelled' */}
                {pass.status === 'cancelled' && (
                    <div className="card border-rose-200 bg-rose-50/40">
                        <div className="card-body">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-cross-circle text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-rose-800">Pass Cancelled</h4>
                                    {pass.cancelled_at && (
                                        <p className="text-xs text-rose-700/80 mt-0.5">
                                            Cancelled by {pass.cancelled_by ?? '—'} on {pass.cancelled_at}
                                        </p>
                                    )}
                                    {pass.cancellation_reason && (
                                        <p className="text-xs text-surface-700 mt-2 whitespace-pre-line bg-white/60 border border-rose-100 rounded-lg px-3 py-2">
                                            <span className="font-bold text-surface-500 text-[10px] uppercase tracking-wider block mb-0.5">Reason</span>
                                            {pass.cancellation_reason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pending approval banner */}
                {pass.status === 'pending_approval' && (
                    <div className="card border-amber-200 bg-amber-50/40">
                        <div className="card-body flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i className="fi fi-rr-hourglass-end text-base" /></div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-amber-800">Waiting for approval</h4>
                                <p className="text-xs text-amber-700/80 mt-0.5">Any one gate-pass approver can approve or reject this pass.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Approved / Rejected details */}
                {pass.approved_by && pass.status !== 'pending_approval' && (
                    <div className="card border-emerald-200 bg-emerald-50/40">
                        <div className="card-body text-sm text-emerald-800">
                            <i className="fi fi-rr-badge-check" /> Approved by <b>{pass.approved_by}</b> on {pass.approved_at}
                        </div>
                    </div>
                )}
                {pass.status === 'rejected' && (
                    <div className="card border-rose-200 bg-rose-50/40">
                        <div className="card-body text-sm text-rose-800">
                            <div><i className="fi fi-rr-cross-circle" /> Rejected by <b>{pass.rejected_by ?? '—'}</b> on {pass.rejected_at}</div>
                            {pass.rejection_reason && <div className="mt-1 text-surface-700 bg-white/60 border border-rose-100 rounded-lg px-3 py-2">{pass.rejection_reason}</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Approve modal */}
            {showApprove && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setShowApprove(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i className="fi fi-rr-check" /></div>
                            <h3 className="text-base font-bold text-surface-900">Approve {pass.pass_no}</h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-surface-600">Approve &amp; issue this gate pass.</p>
                            {mySignatureUrl && (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2">
                                    <div className="text-[11px] font-semibold text-emerald-700 mb-1">Your saved signature (used by default)</div>
                                    <img src={mySignatureUrl} alt="saved signature" className="h-12 object-contain" />
                                </div>
                            )}
                            <div><label className="form-label">{mySignatureUrl ? 'Draw to override (optional)' : 'Signature'}</label><SignaturePad ref={sigRef} /></div>
                        </div>
                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex justify-end gap-2 rounded-b-2xl">
                            <button type="button" onClick={() => setShowApprove(false)} disabled={busy} className="btn-outline">Cancel</button>
                            <button type="button" onClick={doApprove} disabled={busy} className="btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-600">{busy ? 'Approving…' : 'Approve & Issue'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal */}
            {showReject && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setShowReject(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><i className="fi fi-rr-cross-circle" /></div>
                            <h3 className="text-base font-bold text-surface-900">Reject {pass.pass_no}</h3>
                        </div>
                        <div className="p-5 space-y-2">
                            <label className="form-label">Reason <span className="text-red-500">*</span></label>
                            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="form-input" style={{ resize: 'vertical' }} placeholder="Why is this pass rejected?" />
                            <p className="form-hint">Minimum 3 characters.</p>
                        </div>
                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex justify-end gap-2 rounded-b-2xl">
                            <button type="button" onClick={() => setShowReject(false)} disabled={busy} className="btn-outline">Cancel</button>
                            <button type="button" onClick={doReject} disabled={busy || reason.trim().length < 3} className="btn bg-rose-600 hover:bg-rose-700 text-white">{busy ? 'Rejecting…' : 'Reject'}</button>
                        </div>
                    </div>
                </div>
            )}

            <PdfPopupModal
                open={pdfOpen}
                pdfUrl={pdfOpen ? pass.pdf_url : null}
                title={pass.pass_no}
                subtitle={`${isIn ? 'Gate Pass In' : 'Gate Pass Out'} · ${pass.customer ?? pass.rfq_customer ?? ''}`}
                onClose={() => setPdfOpen(false)}
            />
        </AppLayout>
    );
}
