import { Link } from '@inertiajs/react';
import CustomerLayout from '@/Layouts/CustomerLayout';

const STATUS_BADGE: Record<string, string> = {
    open:      'badge-amber',
    in_review: 'badge-blue',
    resolved:  'badge-green',
    closed:    'badge-slate',
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
        </CustomerLayout>
    );
}
