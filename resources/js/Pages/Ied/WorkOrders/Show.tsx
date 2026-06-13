import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

export default function IedWorkOrderShow({ workOrder }: any) {
    const wo = workOrder;
    const [acceptOpen, setAcceptOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const acceptForm = useForm({ note: '' });
    const rejectForm = useForm({ reason: '' });
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string }>({
        open: false, url: null, title: '',
    });

    const submitAccept = (e: React.FormEvent) => {
        e.preventDefault();
        acceptForm.post(`/ied/work-orders/${wo.id}/accept`, {
            preserveScroll: true,
            onSuccess: () => setAcceptOpen(false),
        });
    };
    const submitReject = (e: React.FormEvent) => {
        e.preventDefault();
        rejectForm.post(`/ied/work-orders/${wo.id}/reject`, {
            preserveScroll: true,
            onSuccess: () => setRejectOpen(false),
        });
    };

    const poFile = (wo.files ?? []).find((f: any) => f.kind === 'customer_po');

    return (
        <AppLayout header={`Work Order ${wo.wo_number}`}>
            <div className="space-y-5 max-w-6xl animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-surface-400 font-bold mb-1">Work Order — Awaiting IED Acceptance</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-surface-900 font-mono">{wo.wo_number}</h2>
                                {wo.job_number ? (
                                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold">Job {wo.job_number}</span>
                                ) : (
                                    <span className="text-[10px] text-surface-400 italic">Job # assigned on PCD handoff</span>
                                )}
                                <span className="badge badge-amber capitalize">IED Pending</span>
                                {wo.source === 'customer_portal' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold uppercase">
                                        <i className="fi fi-rr-building text-[9px]" /> Customer-issued
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-surface-700 mt-1">{wo.customer?.name}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                                <span>Submitted {wo.created_at}</span>
                                {wo.created_by && <span>· by {wo.created_by}</span>}
                                {wo.rfq_id && <span>· RFQ #{wo.rfq_id}</span>}
                                {wo.quotation_id && <span>· Q-{String(wo.quotation_id).padStart(5, '0')}</span>}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <Link href="/ied/work-orders" className="btn-ghost btn-sm">
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Inbox
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left: details */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Items */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Job Items ({wo.items?.length ?? 0})</h3>
                            </div>
                            <div className="card-body !p-0 overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Job #</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Qty</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {(wo.items ?? []).map((it: any) => (
                                            <tr key={it.id} className="hover:bg-surface-50/40">
                                                <td className="px-4 py-3 font-mono text-xs text-surface-600">
                                                    {it.job_number ?? <span className="text-surface-300 italic">pending</span>}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-surface-900">
                                                    {it.description}
                                                    {it.product && <div className="text-[11px] text-surface-500">{it.product}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">{it.quantity}</td>
                                                <td className="px-4 py-3 text-xs text-surface-500">{it.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notes */}
                        {wo.notes && (
                            <div className="card">
                                <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Customer Notes</h3></div>
                                <div className="card-body text-sm text-surface-700 whitespace-pre-line leading-relaxed">
                                    {wo.notes}
                                </div>
                            </div>
                        )}

                        {/* Customer Work Order file */}
                        {poFile && (
                            <div className="card">
                                <div className="card-header"><h3 className="text-sm font-bold text-surface-900">{poFile.title ?? 'Customer Work Order'}</h3></div>
                                <div className="card-body">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const ext = (poFile.original_name?.split('.').pop() ?? '').toLowerCase();
                                            if (!poFile.url) return;
                                            const sep = poFile.url.includes('?') ? '&' : '?';
                                            if (ext === 'pdf') {
                                                setPdfPopup({
                                                    open: true,
                                                    url: `${poFile.url}${sep}preview=base64`,
                                                    title: poFile.title ?? poFile.original_name,
                                                });
                                            } else {
                                                window.open(`${poFile.url}${sep}preview=1`, '_blank', 'noreferrer');
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-surface-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <i className="fi fi-rr-file-pdf text-base leading-none" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-surface-900 truncate">{poFile.title ?? 'Customer Work Order'}</div>
                                            <div className="text-[10px] text-surface-400 truncate">{poFile.original_name}</div>
                                        </div>
                                        <i className="fi fi-rr-arrow-up-right-from-square text-[10px] text-surface-400" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar: facts + actions */}
                    <div className="space-y-4">
                        <div className="card">
                            <div className="card-header"><h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Details</h3></div>
                            <div className="card-body space-y-3 text-sm">
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Customer</dt>
                                    <dd className="font-semibold text-surface-900">{wo.customer?.name}</dd>
                                    {wo.customer?.email && <dd className="text-[11px] text-surface-500">{wo.customer.email}</dd>}
                                </div>
                                {wo.customer_po_no && (
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Customer PO No.</dt>
                                        <dd className="font-mono font-semibold text-surface-800">{wo.customer_po_no}</dd>
                                    </div>
                                )}
                                {wo.due_date_label && (
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Required Delivery</dt>
                                        <dd className="font-semibold text-surface-800">{wo.due_date_label}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Priority</dt>
                                    <dd className="capitalize font-semibold text-surface-800">{wo.priority}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Quantity</dt>
                                    <dd className="font-semibold text-surface-800">{wo.quantity}</dd>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="card border-2 border-amber-200 bg-amber-50/30">
                            <div className="card-body space-y-2.5">
                                <button
                                    type="button"
                                    onClick={() => setAcceptOpen(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm"
                                >
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                    Accept &amp; Forward to PCD
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRejectOpen(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-bold"
                                >
                                    <i className="fi fi-rr-cross text-xs leading-none" />
                                    Reject Work Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Accept modal — IED preparer can attach a note for PCD */}
            {acceptOpen && (
                <>
                    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => !acceptForm.processing && setAcceptOpen(false)} />
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="px-5 py-4 border-b border-surface-100 bg-emerald-50/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <i className="fi fi-rr-paper-plane text-emerald-600 leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-surface-900">Forward to PCD</h3>
                                        <p className="text-[11px] text-surface-500">{wo.wo_number} · {wo.customer?.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setAcceptOpen(false)} disabled={acceptForm.processing} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>
                            <form onSubmit={submitAccept} className="p-5 space-y-3">
                                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2.5 text-[11px] text-emerald-800 flex items-start gap-2">
                                    <i className="fi fi-rr-info text-emerald-500 mt-0.5 shrink-0" />
                                    <span>Add a short note for the PCD team — drawings to use, priority caveats, customer site contact, etc. The customer will also be notified that production planning has begun.</span>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Note for PCD <span className="form-label-optional">(optional)</span></label>
                                    <textarea
                                        value={acceptForm.data.note}
                                        onChange={e => acceptForm.setData('note', e.target.value)}
                                        rows={4}
                                        placeholder="e.g. Use Rev-B drawing. Customer requested factory visit before shipping."
                                        className="form-textarea text-sm"
                                        autoFocus
                                    />
                                    {acceptForm.errors.note && <p className="form-error">{acceptForm.errors.note as any}</p>}
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
                                    <button type="button" onClick={() => setAcceptOpen(false)} disabled={acceptForm.processing} className="btn-ghost btn-sm">Cancel</button>
                                    <button
                                        type="submit"
                                        disabled={acceptForm.processing}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
                                    >
                                        {acceptForm.processing ? (
                                            <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Forwarding…</>
                                        ) : (
                                            <><i className="fi fi-rr-paper-plane text-xs leading-none" /> Forward to PCD</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Reject modal */}
            {rejectOpen && (
                <>
                    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => !rejectForm.processing && setRejectOpen(false)} />
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                            <div className="px-5 py-4 border-b border-surface-100 bg-rose-50/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                                        <i className="fi fi-rr-triangle-warning text-rose-600 leading-none" />
                                    </div>
                                    <h3 className="text-base font-bold text-surface-900">Reject Work Order</h3>
                                </div>
                                <button onClick={() => setRejectOpen(false)} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>
                            <form onSubmit={submitReject} className="p-5 space-y-3">
                                <p className="text-xs text-surface-600">
                                    The customer will see this reason in their notification. Be specific so they can fix it.
                                </p>
                                <textarea
                                    value={rejectForm.data.reason}
                                    onChange={e => rejectForm.setData('reason', e.target.value)}
                                    rows={4}
                                    required
                                    placeholder="e.g. The attached PO is incomplete — signature is missing on page 2."
                                    className="form-textarea text-sm"
                                />
                                {rejectForm.errors.reason && <p className="form-error">{rejectForm.errors.reason as any}</p>}
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
                                    <button type="button" onClick={() => setRejectOpen(false)} className="btn-ghost btn-sm">Cancel</button>
                                    <button type="submit" disabled={rejectForm.processing || !rejectForm.data.reason.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-60">
                                        {rejectForm.processing ? 'Rejecting…' : 'Reject Work Order'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}
