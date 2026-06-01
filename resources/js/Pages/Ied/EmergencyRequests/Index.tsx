import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';

const STATUS_BADGE: Record<string, string> = {
    pending:   'badge-amber',
    approved:  'badge-green',
    rejected:  'badge-red',
    cancelled: 'badge-slate',
};

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
};

export default function EmergencyRequestsIndex({ requests, filter, counts }: any) {
    const setStatus = (s: string) => router.get('/ied/emergency-requests', { status: s }, { preserveState: true });

    const tabs = [
        { key: 'pending',  label: 'Pending',  count: counts.pending,  color: 'amber' },
        { key: 'approved', label: 'Approved', count: counts.approved, color: 'emerald' },
        { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'rose' },
        { key: 'all',      label: 'All',      count: null,            color: 'slate' },
    ];

    return (
        <AppLayout header="Customer Emergency Requests">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-siren-on text-base leading-none" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-surface-900">Emergency Production Requests</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Customer-raised urgency requests against in-flight jobs</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap gap-2">
                        {tabs.map(t => (
                            <button key={t.key} onClick={() => setStatus(t.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                                    filter.status === t.key
                                        ? 'bg-surface-900 text-white border-surface-900 shadow-sm'
                                        : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
                                }`}>
                                {t.label}
                                {t.count !== null && t.count > 0 && (
                                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] px-1 rounded-full text-[10px] font-bold ${
                                        filter.status === t.key ? 'bg-white/20' : `bg-${t.color}-100 text-${t.color}-700`
                                    }`}>
                                        {t.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Customer</th>
                                    <th>Reason</th>
                                    <th>Needed By</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.data.map((r: any) => (
                                    <tr key={r.id} className={r.status === 'pending' ? 'bg-amber-50/30' : ''}>
                                        <td>
                                            <Link href={`/ied/emergency-requests/${r.id}`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
                                                {r.wo_number}
                                            </Link>
                                            {r.product && <div className="text-[11px] text-surface-500 mt-0.5 truncate max-w-[180px]">{r.product}</div>}
                                            <div className="mt-1 flex items-center gap-1.5">
                                                {r.item_scope === 'item' ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold uppercase tracking-wide">
                                                        <i className="fi fi-rr-box text-[8px] leading-none mr-1" />
                                                        Job #{r.job_number}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 text-[9px] font-semibold uppercase tracking-wide">
                                                        Whole job
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-sm font-medium text-surface-800">{r.customer}</td>
                                        <td className="max-w-[260px]">
                                            <div className="text-xs text-surface-700 line-clamp-2">{r.reason}</div>
                                        </td>
                                        <td className="text-xs text-surface-500">{r.needed_by ?? <span className="text-surface-300">—</span>}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                                        </td>
                                        <td className="text-xs text-surface-400">{r.created_at}</td>
                                        <td className="text-right">
                                            <Link href={`/ied/emergency-requests/${r.id}`} className="btn-outline btn-xs">
                                                {r.status === 'pending' ? 'Review' : 'View'} <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {requests.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-siren" /></div>
                                                <p className="empty-state-title">No emergency requests</p>
                                                <p className="empty-state-text">Customers haven't raised any urgent requests in this view.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
