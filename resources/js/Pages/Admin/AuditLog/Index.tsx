import AppLayout from '@/Layouts/AppLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const eventBadgeClass: Record<string, string> = {
    created: 'badge-green',
    updated: 'badge-blue',
    deleted: 'badge-red',
    status_changed: 'badge-amber',
    approved: 'badge-green',
    rejected: 'badge-red',
};

export default function AuditLogIndex({ logs, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [event, setEvent] = useState(filters?.event ?? '');

    const apply = () => router.get('/admin/audit-log', { search, event }, { preserveState: true });

    const rows = logs.data ?? [];

    return (
        <AppLayout header="Audit Log">
            <div className="space-y-6 animate-fade-in">

                {/* Filter Bar */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 form-group">
                                <label className="form-label">
                                    <i className="fi fi-rr-search mr-1.5 text-xs" />
                                    Search
                                </label>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && apply()}
                                    placeholder="WO number, user, description..."
                                    className="form-input"
                                />
                            </div>
                            <div className="sm:w-48 form-group">
                                <label className="form-label">Event Type</label>
                                <select
                                    value={event}
                                    onChange={e => {
                                        setEvent(e.target.value);
                                        router.get('/admin/audit-log', { search, event: e.target.value }, { preserveState: true });
                                    }}
                                    className="form-select"
                                >
                                    <option value="">All events</option>
                                    <option value="created">Created</option>
                                    <option value="updated">Updated</option>
                                    <option value="deleted">Deleted</option>
                                    <option value="status_changed">Status Changed</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <button onClick={apply} className="btn-primary btn-sm">
                                <i className="fi fi-rr-filter mr-1.5" />
                                Filter
                            </button>
                        </div>
                    </div>
                </div>

                {/* Log Table */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white">
                                <i className="fi fi-rr-time-past text-lg" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">Activity Log</h2>
                                <p className="text-sm text-surface-500">System-wide audit trail</p>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-time-past text-2xl" />
                                </div>
                                <div className="empty-state-title">No audit entries found</div>
                                <div className="empty-state-text">Try adjusting your filters or search terms.</div>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>User</th>
                                        <th>Event</th>
                                        <th>Model</th>
                                        <th>Description</th>
                                        <th>IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((log: any) => (
                                        <tr key={log.id}>
                                            <td className="text-xs text-surface-500 whitespace-nowrap">{log.created_at}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center text-surface-600 text-[10px] font-bold flex-shrink-0">
                                                        {(log.causer_name ?? 'S').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-surface-700">{log.causer_name ?? 'System'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${eventBadgeClass[log.event] ?? 'badge-slate'}`}>
                                                    {log.event}
                                                </span>
                                            </td>
                                            <td className="text-xs text-surface-500">{log.auditable_type?.split('\\').pop()}</td>
                                            <td className="text-surface-700 max-w-xs truncate">{log.description}</td>
                                            <td className="text-xs text-surface-400 font-mono">{log.ip_address}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden card-body space-y-3">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-time-past text-2xl" />
                                </div>
                                <div className="empty-state-title">No audit entries found</div>
                                <div className="empty-state-text">Try adjusting your filters or search terms.</div>
                            </div>
                        ) : (
                            rows.map((log: any) => (
                                <div key={log.id} className="rounded-xl border border-surface-200 p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`badge ${eventBadgeClass[log.event] ?? 'badge-slate'}`}>
                                            {log.event}
                                        </span>
                                        <span className="text-xs text-surface-400">{log.created_at}</span>
                                    </div>
                                    <div className="text-sm text-surface-700">{log.description}</div>
                                    <div className="flex items-center justify-between text-xs text-surface-500">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-surface-200 flex items-center justify-center text-surface-600 text-[9px] font-bold">
                                                {(log.causer_name ?? 'S').charAt(0).toUpperCase()}
                                            </div>
                                            {log.causer_name ?? 'System'}
                                        </div>
                                        <span className="text-surface-400">{log.auditable_type?.split('\\').pop()}</span>
                                    </div>
                                    {log.ip_address && (
                                        <div className="text-[11px] text-surface-400 font-mono">IP: {log.ip_address}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
