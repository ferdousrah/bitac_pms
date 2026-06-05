import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const STATE_BADGE: Record<string, string> = {
    running:     'badge-green',
    idle:        'badge-blue',
    setup:       'badge-amber',
    maintenance: 'badge-purple',
    breakdown:   'badge-red',
    offline:     'badge-slate',
};

const HEALTH_BADGE: Record<string, string> = {
    green:  'badge-green',
    blue:   'badge-blue',
    amber:  'badge-amber',
    orange: 'badge-amber',
    red:    'badge-red',
};

const fmt = (v: any) => v != null ? `৳${Number(v).toLocaleString('en-IN')}` : '—';

export default function MachinesIndex({ machines, fleet, sections = [], filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [sectionId, setSectionId] = useState(filters?.section_id ?? '');
    const [currentState, setCurrentState] = useState(filters?.current_state ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');

    const apply = (override: any = {}) => router.get('/admin/machines',
        { search, section_id: sectionId, current_state: currentState, status, ...override },
        { preserveState: true, replace: true });

    const reset = () => {
        setSearch(''); setSectionId(''); setCurrentState(''); setStatus('');
        router.get('/admin/machines', {}, { preserveState: true, replace: true });
    };

    const remove = (id: number, name: string) => {
        if (!confirm(`Delete machine "${name}"?`)) return;
        router.delete(`/admin/machines/${id}`);
    };

    const rows = machines?.data ?? machines ?? [];
    const hasFilters = !!(search || sectionId || currentState || status);

    return (
        <AppLayout header="Machines">
            <div className="space-y-6 animate-fade-in">

                {/* Fleet Summary Cards */}
                {fleet && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <FleetCard label="Total" value={fleet.total} icon="fi-rr-settings" color="blue" />
                        <FleetCard label="Running" value={fleet.running} icon="fi-sr-circle-small" color="green" pulse />
                        <FleetCard label="Idle" value={fleet.idle} icon="fi-rr-pause-circle" color="slate" />
                        <FleetCard label="Maintenance" value={fleet.maintenance} icon="fi-rr-wrench-simple" color="purple" />
                        <FleetCard label="Breakdown" value={fleet.breakdown} icon="fi-rr-triangle-warning" color="red" />
                        <FleetCard label="Avg Health" value={`${fleet.avg_health}%`} icon="fi-rr-pulse" color="brand" />
                    </div>
                )}

                {/* Alerts */}
                {fleet && (fleet.overdue > 0 || fleet.due_soon > 0) && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-bell-ring text-amber-500 text-base leading-none shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <strong className="font-semibold">Maintenance attention required:</strong>{' '}
                            {fleet.overdue > 0 && <span className="text-red-700">{fleet.overdue} overdue</span>}
                            {fleet.overdue > 0 && fleet.due_soon > 0 && <span className="mx-2 text-amber-400">·</span>}
                            {fleet.due_soon > 0 && <span>{fleet.due_soon} due within 7 days</span>}
                        </div>
                    </div>
                )}

                {/* Main Table */}
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Machine Fleet</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {machines?.total ?? rows.length} machine{(machines?.total ?? rows.length) !== 1 && 's'}{hasFilters && ' matching filters'} with health tracking
                            </p>
                        </div>
                        <Link href="/admin/machines/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" />
                            New Machine
                        </Link>
                    </div>

                    {/* Filter toolbar */}
                    <div className="card-body border-b border-surface-100 flex flex-col lg:flex-row gap-2 lg:items-center">
                        <div className="relative flex-1 min-w-0">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search code, name, manufacturer, model, location…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={sectionId}
                            onChange={e => { setSectionId(e.target.value); apply({ section_id: e.target.value }); }}
                            className="form-select lg:w-48">
                            <option value="">All sections</option>
                            {sections.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <select value={currentState}
                            onChange={e => { setCurrentState(e.target.value); apply({ current_state: e.target.value }); }}
                            className="form-select lg:w-40">
                            <option value="">Any state</option>
                            <option value="running">Running</option>
                            <option value="idle">Idle</option>
                            <option value="setup">Setup</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="breakdown">Breakdown</option>
                            <option value="offline">Offline</option>
                        </select>
                        <select value={status}
                            onChange={e => { setStatus(e.target.value); apply({ status: e.target.value }); }}
                            className="form-select lg:w-40">
                            <option value="">Any status</option>
                            <option value="operational">Operational</option>
                            <option value="maintenance">Under Maintenance</option>
                            <option value="offline">Offline</option>
                        </select>
                        <button onClick={() => apply()} className="btn-outline btn-sm shrink-0">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {hasFilters && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500 shrink-0">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="card-body hidden lg:block overflow-x-auto p-0">
                        {rows.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Machine</th>
                                        <th>Section</th>
                                        <th>State</th>
                                        <th>Health</th>
                                        <th>Maintenance</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((m: any) => (
                                        <tr key={m.id}>
                                            <td>
                                                <Link href={`/admin/machines/${m.id}`} className="block group">
                                                    <span className="font-mono text-xs text-surface-500">{m.machine_code}</span>
                                                    <div className="font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">{m.name}</div>
                                                </Link>
                                            </td>
                                            <td className="text-surface-600 text-sm">{m.section?.name ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${STATE_BADGE[m.current_state] ?? 'badge-slate'} capitalize`}>
                                                    {m.current_state === 'running' && (
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                                                        </span>
                                                    )}
                                                    {m.current_state}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                                        <div className={`h-full bg-${m.health_color}-500`}
                                                            style={{ width: `${m.health_score}%` }} />
                                                    </div>
                                                    <span className={`badge ${HEALTH_BADGE[m.health_color] ?? 'badge-slate'} text-[10px]`}>
                                                        {m.health_score}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-surface-400 mt-0.5">{m.health_label}</div>
                                            </td>
                                            <td>
                                                {m.maintenance_status === 'overdue' && (
                                                    <span className="badge badge-red text-[10px]">
                                                        <i className="fi fi-rr-triangle-warning text-[8px]" />
                                                        {Math.abs(m.days_until_maint)}d overdue
                                                    </span>
                                                )}
                                                {m.maintenance_status === 'due_soon' && (
                                                    <span className="badge badge-amber text-[10px]">
                                                        Due in {m.days_until_maint}d
                                                    </span>
                                                )}
                                                {m.maintenance_status === 'on_schedule' && (
                                                    <span className="badge badge-green text-[10px]">
                                                        in {m.days_until_maint}d
                                                    </span>
                                                )}
                                                {m.maintenance_status === 'not_scheduled' && (
                                                    <span className="text-xs text-surface-300">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-1">
                                                    <Link href={`/admin/machines/${m.id}`} className="btn-ghost btn-xs" title="View health">
                                                        <i className="fi fi-rr-pulse text-xs leading-none" />
                                                    </Link>
                                                    <Link href={`/admin/machines/${m.id}/edit`} className="btn-ghost btn-xs" title="Edit">
                                                        <i className="fi fi-rr-pencil text-xs leading-none" />
                                                    </Link>
                                                    <button onClick={() => remove(m.id, m.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50" title="Delete">
                                                        <i className="fi fi-rr-trash text-xs leading-none" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-settings" /></div>
                                <div className="empty-state-title">No machines yet</div>
                                <div className="empty-state-text">Add machines so they can be assigned to operations.</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="card-body lg:hidden space-y-3">
                        {rows.map((m: any) => (
                            <Link key={m.id} href={`/admin/machines/${m.id}`} className="block rounded-xl border border-surface-100 p-4 space-y-3 hover:border-brand-200 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="font-mono text-xs text-surface-500">{m.machine_code}</span>
                                        <div className="font-semibold text-surface-900 text-sm mt-0.5">{m.name}</div>
                                        <div className="text-xs text-surface-500">{m.section?.name ?? '—'}</div>
                                    </div>
                                    <span className={`badge ${STATE_BADGE[m.current_state] ?? 'badge-slate'} capitalize`}>
                                        {m.current_state}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-surface-400">Health</span>
                                    <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                        <div className={`h-full bg-${m.health_color}-500`} style={{ width: `${m.health_score}%` }} />
                                    </div>
                                    <span className={`badge ${HEALTH_BADGE[m.health_color] ?? 'badge-slate'} text-[10px]`}>
                                        {m.health_score} · {m.health_label}
                                    </span>
                                </div>
                                {m.maintenance_status === 'overdue' && (
                                    <div className="text-xs text-red-600 font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-triangle-warning text-xs" />
                                        Maintenance overdue by {Math.abs(m.days_until_maint)} days
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function FleetCard({ label, value, icon, color, pulse }: { label: string; value: any; icon: string; color: string; pulse?: boolean }) {
    const colorMap: Record<string, string> = {
        blue:   'from-blue-400 to-blue-600 text-blue-600 bg-blue-50',
        green:  'from-emerald-400 to-emerald-600 text-emerald-600 bg-emerald-50',
        slate:  'from-slate-400 to-slate-600 text-slate-600 bg-slate-50',
        purple: 'from-purple-400 to-purple-600 text-purple-600 bg-purple-50',
        red:    'from-red-400 to-red-600 text-red-600 bg-red-50',
        brand:  'from-brand-400 to-brand-600 text-brand-600 bg-brand-50',
    };
    const colorClass = colorMap[color] ?? colorMap.blue;
    const [, , textColor, bgColor] = colorClass.split(' ');

    return (
        <div className="card p-4">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bgColor} ${textColor} flex items-center justify-center shrink-0 relative`}>
                    {pulse && <span className={`absolute inset-0 rounded-xl ${bgColor} animate-ping opacity-50`} />}
                    <i className={`fi ${icon} text-base leading-none relative`} />
                </div>
                <div>
                    <div className="text-xl font-bold text-surface-900 leading-none">{value}</div>
                    <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</div>
                </div>
            </div>
        </div>
    );
}
