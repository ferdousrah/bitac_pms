import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';

const STATUS_BADGE: Record<string, string> = {
    pending:     'badge-amber',
    approved:    'badge-blue',
    rejected:    'badge-red',
    in_progress: 'badge-purple',
    completed:   'badge-green',
    cancelled:   'badge-slate',
};

const URGENCY_BADGE: Record<string, string> = {
    urgent: 'bg-rose-50 text-rose-700 border-rose-200',
    normal: 'bg-amber-50 text-amber-700 border-amber-200',
    low:    'bg-slate-50 text-slate-700 border-slate-200',
};

export default function MaintenanceIndex({ requests, filters, counts, can }: any) {
    const setStatus = (s: string) => router.get('/maintenance-requests', { ...filters, status: s }, { preserveState: true });

    const tabs = [
        { key: 'open',        label: 'Open',         count: counts.pending + counts.approved + counts.in_progress },
        { key: 'pending',     label: 'Pending',      count: counts.pending },
        { key: 'approved',    label: 'Approved',     count: counts.approved },
        { key: 'in_progress', label: 'In Progress',  count: counts.in_progress },
        { key: 'completed',   label: 'Completed',    count: counts.completed },
        { key: 'rejected',    label: 'Rejected',     count: counts.rejected },
        { key: 'all',         label: 'All',          count: null },
    ];

    return (
        <AppLayout header="Maintenance Requests">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-wrench-simple text-base leading-none" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-surface-900">Maintenance Requests</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Shop floor requests → review → execute</p>
                            </div>
                        </div>
                        {can?.submit && (
                            <Link href="/maintenance-requests/create" className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> New Request
                            </Link>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap gap-2">
                        {tabs.map(t => (
                            <button key={t.key} onClick={() => setStatus(t.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                    filters.status === t.key
                                        ? 'bg-surface-900 text-white border-surface-900 shadow-sm'
                                        : 'bg-white text-surface-600 hover:bg-surface-50 border-surface-200'
                                }`}>
                                {t.label}
                                {t.count !== null && t.count > 0 && (
                                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] px-1 rounded-full text-[10px] font-bold ${
                                        filters.status === t.key ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
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
                                    <th>Machine</th>
                                    <th>Problem</th>
                                    <th>Urgency</th>
                                    <th>Status</th>
                                    <th>Requested By</th>
                                    <th>Submitted</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.data.map((r: any) => (
                                    <tr key={r.id} className={r.status === 'pending' ? 'bg-amber-50/30' : ''}>
                                        <td>
                                            <Link href={`/maintenance-requests/${r.id}`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
                                                {r.machine?.machine_code ?? '—'}
                                            </Link>
                                            <div className="text-[11px] text-surface-500 mt-0.5 truncate max-w-[160px]">{r.machine?.name}</div>
                                            {r.section && <div className="text-[10px] text-surface-400 mt-0.5">{r.section}</div>}
                                        </td>
                                        <td className="max-w-[280px]">
                                            <div className="text-xs text-surface-700 line-clamp-2">{r.reported_problem}</div>
                                            {r.attachment_count > 0 && (
                                                <div className="text-[10px] text-surface-400 mt-1 inline-flex items-center gap-1">
                                                    <i className="fi fi-rr-camera text-[9px] leading-none" /> {r.attachment_count} photo{r.attachment_count > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${URGENCY_BADGE[r.urgency]}`}>
                                                {r.urgency}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status_label}</span>
                                        </td>
                                        <td className="text-sm text-surface-700">{r.requester ?? '—'}</td>
                                        <td className="text-xs text-surface-400">{r.created_at}</td>
                                        <td className="text-right">
                                            <Link href={`/maintenance-requests/${r.id}`} className="btn-outline btn-xs">
                                                {r.status === 'pending' ? 'Review' : 'View'} <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {requests.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-wrench-simple" /></div>
                                                <p className="empty-state-title">No maintenance requests</p>
                                                <p className="empty-state-text">Shop floor requests appear here when raised.</p>
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
