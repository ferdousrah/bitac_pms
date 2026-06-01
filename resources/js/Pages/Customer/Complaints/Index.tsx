import { Link } from '@inertiajs/react';
import CustomerLayout from '@/Layouts/CustomerLayout';

const STATUS_BADGE: Record<string, string> = {
    open:      'badge-amber',
    in_review: 'badge-blue',
    resolved:  'badge-green',
    closed:    'badge-slate',
};

const CATEGORY_LABEL: Record<string, string> = {
    general: 'General',
    quality: 'Quality',
    delivery: 'Delivery',
    billing: 'Billing',
    other: 'Other',
};

export default function CustomerComplaintsIndex({ complaints }: any) {
    const rows = complaints?.data ?? [];

    return (
        <CustomerLayout title="Feedback / Compliment">
            <div className="flex items-center justify-end">
                <Link href="/customer/complaints/create" className="btn-primary btn-sm">
                    <i className="fi fi-rr-plus text-xs leading-none" /> New Feedback/Compliment
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="text-sm font-semibold text-surface-800">All Feedback &amp; Compliments</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Track status of your feedback and compliments</p>
                </div>
                <div className="card-body p-0">
                    {rows.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className="fi fi-rr-comment-alt" /></div>
                            <p className="empty-state-title">No submissions yet</p>
                            <p className="empty-state-text">Share feedback, raise an issue, or compliment any of your orders.</p>
                            <div className="mt-4">
                                <Link href="/customer/complaints/create" className="btn-primary btn-sm">
                                    <i className="fi fi-rr-plus text-xs leading-none" /> Submit Feedback/Compliment
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Ref. No</th>
                                    <th>Subject</th>
                                    <th>Category</th>
                                    <th>Related Job</th>
                                    <th>Status</th>
                                    <th>Filed</th>
                                    <th>Responded</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c: any) => (
                                    <tr key={c.id} className="group cursor-pointer" onClick={() => window.location.assign(`/customer/complaints/${c.id}`)}>
                                        <td>
                                            <Link href={`/customer/complaints/${c.id}`} className="font-mono font-semibold text-rose-600 hover:underline">
                                                {c.reference_number}
                                            </Link>
                                        </td>
                                        <td className="text-surface-800 font-medium">{c.subject}</td>
                                        <td className="text-xs text-surface-600">{CATEGORY_LABEL[c.category] ?? c.category}</td>
                                        <td>
                                            {c.work_order ? (
                                                <div>
                                                    <div className="font-bold text-surface-900">Job #{c.work_order.job_number ?? '—'}</div>
                                                    <div className="text-[11px] text-surface-400 font-mono mt-0.5">{c.work_order.wo_number}</div>
                                                </div>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-slate'}`}>{c.status.replace(/_/g, ' ')}</span>
                                        </td>
                                        <td className="text-xs text-surface-500">{c.created_at}</td>
                                        <td className="text-xs text-surface-500">{c.responded_at ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
}
