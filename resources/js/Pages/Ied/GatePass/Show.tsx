import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

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
    status: 'draft' | 'issued' | 'completed' | 'cancelled';
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

export default function GatePassShow({ pass, basePath = '/ied/gate-passes' }: any) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const isIn = pass.direction === 'in';
    const isActive = pass.status === 'issued';

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
                                            {isIn ? 'Gate-In' : 'Gate-Out'}
                                        </span>
                                        <span className={`badge capitalize ${
                                            pass.status === 'issued' ? 'badge-blue'
                                            : pass.status === 'completed' ? 'badge-green'
                                            : pass.status === 'cancelled' ? 'badge-red'
                                            : 'badge-slate'
                                        }`}>
                                            {pass.status}
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
                                        <td className="px-3 py-2 text-xs text-surface-600 align-top whitespace-pre-line">{it.condition_note ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

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
            </div>

            <PdfPopupModal
                open={pdfOpen}
                pdfUrl={pdfOpen ? pass.pdf_url : null}
                title={pass.pass_no}
                subtitle={`${isIn ? 'Gate-In' : 'Gate-Out'} · ${pass.rfq_customer ?? ''}`}
                onClose={() => setPdfOpen(false)}
            />
        </AppLayout>
    );
}
