import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    accepted:  'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected:  'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPE_LABEL: Record<string, string> = {
    student:      'Student',
    consultancy:  'Consultancy',
    organization: 'Organization',
};

const MODE_LABEL: Record<string, string> = {
    in_person: 'In-person',
    online:    'Online',
    written:   'Written',
};

export default function ConsultancyRequestsIndex({ requests, filters, stats }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');
    const [type, setType] = useState(filters?.type ?? '');

    const apply = () => router.get('/ied/consultancy-requests', { search, status, type }, { preserveState: true });
    const reset = () => {
        setSearch(''); setStatus(''); setType('');
        router.get('/ied/consultancy-requests');
    };

    const rows = requests?.data ?? [];

    return (
        <AppLayout header="Consultancy Requests">
            <div className="space-y-6 animate-fade-in">

                {/* Stat tiles */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat label="Pending"   value={stats.pending}   color="amber"   icon="fi-rr-time-check" />
                    <Stat label="Accepted"  value={stats.accepted}  color="blue"    icon="fi-rr-check-circle" />
                    <Stat label="Completed" value={stats.completed} color="emerald" icon="fi-rr-flag-alt" />
                    <Stat label="Rejected"  value={stats.rejected}  color="rose"    icon="fi-rr-cross-circle" />
                    <Stat label="Total"     value={stats.total}     color="indigo"  icon="fi-rr-graduation-cap" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Public Consultancy Requests</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Submitted via the public form at <span className="font-mono">/consultancy/request</span></p>
                        </div>
                        <Link href="/ied/consultancy-requests/report" className="btn-outline btn-sm">
                            <i className="fi fi-rr-stats text-xs leading-none" /> Annual Report
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search ref #, name, subject, organisation…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={status} onChange={e => setStatus(e.target.value)} className="form-select w-auto">
                            <option value="">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="completed">Completed</option>
                            <option value="rejected">Rejected</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select value={type} onChange={e => setType(e.target.value)} className="form-select w-auto">
                            <option value="">All types</option>
                            <option value="student">Students</option>
                            <option value="consultancy">Consultancy</option>
                            <option value="organization">Organizations</option>
                        </select>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {(search || status || type) && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Ref #</th>
                                    <th>Requester</th>
                                    <th>Subject</th>
                                    <th>Mode</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th className="text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id}>
                                        <td>
                                            <Link href={`/ied/consultancy-requests/${r.id}`} className="font-mono text-xs font-bold text-indigo-600 hover:underline">
                                                {r.request_number}
                                            </Link>
                                        </td>
                                        <td>
                                            <div className="text-sm font-medium text-surface-900">{r.requester_name}</div>
                                            <div className="text-[10px] text-surface-400 mt-0.5">
                                                <span className="inline-flex px-1.5 py-0.5 rounded-md bg-surface-100 text-surface-700 text-[9px] font-bold uppercase tracking-wider">
                                                    {TYPE_LABEL[r.requester_type] ?? r.requester_type}
                                                </span>
                                                {r.organization_name && <span className="ml-1.5">{r.organization_name}</span>}
                                            </div>
                                        </td>
                                        <td className="text-sm text-surface-700 max-w-[260px] truncate">{r.subject}</td>
                                        <td className="text-xs text-surface-500">{MODE_LABEL[r.preferred_mode] ?? r.preferred_mode}</td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[r.status]}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="text-xs text-surface-500">{r.created_at}</td>
                                        <td className="text-right">
                                            <Link href={`/ied/consultancy-requests/${r.id}`} className="btn-ghost btn-xs">
                                                View <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-graduation-cap" /></div>
                                                <p className="empty-state-title">No requests yet</p>
                                                <p className="empty-state-text">Public submissions will appear here. Share the form link: <code className="text-[10px] bg-surface-100 px-2 py-1 rounded">/consultancy/request</code></p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {requests?.links && requests.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                            {requests.links.map((l: any, i: number) => (
                                <Link key={i} href={l.url ?? '#'} preserveScroll
                                    className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                        l.active ? 'bg-surface-900 text-white'
                                        : l.url ? 'text-surface-700 hover:bg-surface-100'
                                        : 'text-surface-300 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: l.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function Stat({ label, value, color, icon }: any) {
    const colors: Record<string, string> = {
        indigo:  'from-indigo-50 to-indigo-100 text-indigo-600',
        emerald: 'from-emerald-50 to-emerald-100 text-emerald-600',
        amber:   'from-amber-50 to-amber-100 text-amber-600',
        blue:    'from-blue-50 to-blue-100 text-blue-600',
        rose:    'from-rose-50 to-rose-100 text-rose-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-surface-100 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
                    <div className="font-bold text-2xl text-surface-900 mt-1 font-mono leading-none">{value}</div>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shrink-0`}>
                    <i className={`fi ${icon} text-sm leading-none`} />
                </div>
            </div>
        </div>
    );
}
