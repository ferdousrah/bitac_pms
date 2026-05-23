import { Link } from '@inertiajs/react';
import { useState } from 'react';
import CustomerLayout from '@/Layouts/CustomerLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    open:                'badge-amber',
    in_review:           'badge-blue',
    accepted_for_rework: 'badge-rose',
    resolved:            'badge-green',
    closed:              'badge-slate',
};

const REWORK_STATUS_BADGE: Record<string, string> = {
    open:        'badge-amber',
    in_progress: 'badge-blue',
    completed:   'badge-green',
};

const CATEGORY_LABEL: Record<string, string> = {
    general: 'General Feedback',
    quality: 'Quality Issue',
    delivery: 'Delivery Issue',
    billing: 'Billing / Invoice Issue',
    other: 'Other',
};

export default function CustomerComplaintShow({ complaint }: any) {
    const isResolved = ['resolved', 'closed'].includes(complaint.status);
    const [showGatePdf, setShowGatePdf] = useState(false);

    return (
        <CustomerLayout backHref="/customer/complaints" backLabel="All Complaints" width="narrow">
            {/* Header */}
            <div className="card">
                <div className="card-body">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Complaint</div>
                            <h2 className="text-xl font-bold font-mono text-rose-600 mt-1">{complaint.reference_number}</h2>
                            <p className="text-surface-800 text-base font-semibold mt-2">{complaint.subject}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-surface-500 flex-wrap">
                                <span><i className="fi fi-rr-tag-alt text-[10px]" /> {CATEGORY_LABEL[complaint.category] ?? complaint.category}</span>
                                <span><i className="fi fi-rr-calendar text-[10px]" /> {complaint.created_at}</span>
                                {complaint.work_order && (
                                    <Link href={`/customer/work-orders/${complaint.work_order.id}`} className="text-brand-600 hover:underline">
                                        <i className="fi fi-rr-briefcase text-[10px]" /> Job #{complaint.work_order.job_number ?? '—'} ({complaint.work_order.wo_number})
                                    </Link>
                                )}
                                {complaint.affected_qty != null && complaint.total_qty != null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-700 font-semibold">
                                        <i className="fi fi-rr-triangle-warning text-[10px]" />
                                        {complaint.affected_qty} of {complaint.total_qty} units defective
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className={`badge ${STATUS_BADGE[complaint.status] ?? 'badge-slate'}`}>
                            {complaint.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Original message */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-sm font-semibold text-surface-800">Your Message</h3>
                </div>
                <div className="card-body">
                    <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed">
                        {complaint.message}
                    </div>
                </div>
            </div>

            {/* Rework banner — when BITAC accepted the complaint and routed to rework */}
            {complaint.ncr && (
                <div className="card border-rose-300 overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-700 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="fi fi-rr-refresh text-base leading-none" />
                            <span className="text-sm font-bold uppercase tracking-wider">Accepted for Rework</span>
                        </div>
                        <span className="text-[11px] text-white/90">{complaint.accepted_at}</span>
                    </div>
                    <div className="card-body space-y-3">
                        <div className="text-sm text-surface-700">
                            We've accepted your complaint and are reworking your job. You'll be notified when the rework is complete and re-dispatched.
                        </div>
                        <div className="text-xs">
                            <span className="text-surface-500">NCR Reference:</span>{' '}
                            <span className="font-mono font-semibold text-rose-700">{complaint.ncr.ncr_number}</span>
                            <span className={`badge ${complaint.ncr.status === 'closed' ? 'badge-green' : 'badge-amber'} ml-2 text-[10px]`}>
                                {String(complaint.ncr.status).replace(/_/g, ' ')}
                            </span>
                        </div>
                        {complaint.ncr.reworks?.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Sections doing the rework</div>
                                <div className="space-y-1.5">
                                    {complaint.ncr.reworks.map((r: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between text-xs rounded-lg bg-rose-50/60 border border-rose-100 px-3 py-2">
                                            <div>
                                                <span className="font-semibold text-surface-900">{r.section ?? 'Section'}</span>
                                                <span className="text-surface-500 ml-2 font-mono">{r.rework_number}</span>
                                            </div>
                                            <span className={`badge ${REWORK_STATUS_BADGE[r.status] ?? 'badge-slate'} text-[9px]`}>
                                                {String(r.status).replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {complaint.gate_pass && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-xs">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <div className="font-semibold text-amber-900">
                                            <i className="fi fi-rr-shield-check text-[11px]" /> Sample Return Gate-In Pass
                                        </div>
                                        <div className="text-amber-800 mt-1">
                                            Pass No: <b className="font-mono">{complaint.gate_pass.pass_no}</b> · {String(complaint.gate_pass.status).replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowGatePdf(true)}
                                        className="btn-outline btn-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                                    >
                                        <i className="fi fi-rr-file-pdf text-[10px]" /> View Gate Pass PDF
                                    </button>
                                </div>
                                <div className="text-amber-700 mt-2 text-[11px]">
                                    Print the pass and show it at the BITAC gate when bringing back the defective part(s).
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* BITAC response */}
            {complaint.response ? (
                <div className="card border-emerald-300 overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="fi fi-rr-comment-check text-base leading-none" />
                            <span className="text-sm font-bold uppercase tracking-wider">BITAC Response</span>
                        </div>
                        <span className="text-[11px] text-white/90">{complaint.responded_at}</span>
                    </div>
                    <div className="card-body space-y-2">
                        <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed">
                            {complaint.response}
                        </div>
                        {complaint.responded_by && (
                            <div className="text-[11px] text-surface-500 italic">— {complaint.responded_by}</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm flex items-start gap-3">
                    <i className="fi fi-rr-time-check text-amber-600 leading-none text-lg mt-0.5" />
                    <div>
                        <div className="font-semibold text-amber-900">Awaiting response</div>
                        <div className="text-amber-700 mt-0.5 text-xs">
                            Our team has received your feedback. We'll respond within 2 business days.
                        </div>
                    </div>
                </div>
            )}

            {isResolved && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                    <i className="fi fi-rr-check-circle leading-none" /> This complaint has been marked <b>{complaint.status}</b>. Please file a new complaint if you have further concerns.
                </div>
            )}

            <div className="flex items-center gap-3">
                <Link href="/customer/complaints" className="btn-outline btn-sm">
                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> All Complaints
                </Link>
                <Link href="/customer/complaints/create" className="btn-ghost btn-sm">
                    <i className="fi fi-rr-plus text-xs leading-none" /> New Complaint
                </Link>
            </div>

            <PdfPopupModal
                open={showGatePdf}
                pdfUrl={showGatePdf && complaint.gate_pass
                    ? `/customer/documents/gate-pass/${complaint.gate_pass.id}?preview=base64`
                    : null}
                title={complaint.gate_pass ? `Gate-In Pass ${complaint.gate_pass.pass_no}` : 'Gate Pass'}
                subtitle={`Complaint ${complaint.reference_number}`}
                onClose={() => setShowGatePdf(false)}
            />
        </CustomerLayout>
    );
}
