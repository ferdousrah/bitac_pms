import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const VALUE_BADGE: Record<string, string> = {
    low:    'bg-slate-50 text-slate-600 border-slate-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high:   'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const VOLUME_LABEL: Record<string, string> = {
    one_time:   'One-time',
    occasional: 'Occasional',
    frequent:   'Frequent',
    regular:    'Regular',
};

export default function ServiceDemandIndex({ logs, filters, categories, availableYears, stats }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [category, setCategory] = useState(filters?.category ?? '');
    const [volume, setVolume] = useState(filters?.volume ?? '');
    const [value, setValue] = useState(filters?.value ?? '');
    const [year, setYear] = useState(filters?.year ?? '');

    const apply = () => router.get('/ied/service-demand', { search, category, volume, value, year }, { preserveState: true });
    const reset = () => {
        setSearch(''); setCategory(''); setVolume(''); setValue(''); setYear('');
        router.get('/ied/service-demand');
    };

    const remove = (id: number, name: string) => {
        if (!confirm(`Delete entry "${name}"?\n\nThis can't be undone.`)) return;
        router.delete(`/ied/service-demand/${id}`);
    };

    const rows = logs?.data ?? [];

    return (
        <AppLayout header="Service Demand Log">
            <div className="space-y-6 animate-fade-in">

                {/* Stat tiles */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Stat label={`Logged in ${new Date().getFullYear()}`} value={stats.total_year}  color="indigo" icon="fi-rr-edit" />
                    <Stat label="High-Value Entries" value={stats.high_value} color="emerald" icon="fi-rr-trending-up" />
                    <Stat label="Unique Services Asked" value={stats.unique_svc} color="amber"   icon="fi-rr-bullseye" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Service Demand Log</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Internal log of services people asked for that BITAC currently doesn't provide.
                                Year-end report reveals investment opportunities.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/ied/service-demand/report" className="btn-outline btn-sm">
                                <i className="fi fi-rr-stats text-xs leading-none" /> Annual Report
                            </Link>
                            <Link href="/ied/service-demand/create" className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> New Entry
                            </Link>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search service, requester, context…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="form-select w-auto">
                            <option value="">All categories</option>
                            {Object.entries(categories).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={value} onChange={e => setValue(e.target.value)} className="form-select w-auto">
                            <option value="">All values</option>
                            <option value="high">High value</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        <select value={volume} onChange={e => setVolume(e.target.value)} className="form-select w-auto">
                            <option value="">All volumes</option>
                            <option value="regular">Regular</option>
                            <option value="frequent">Frequent</option>
                            <option value="occasional">Occasional</option>
                            <option value="one_time">One-time</option>
                        </select>
                        <select value={year} onChange={e => setYear(e.target.value)} className="form-select w-auto font-mono">
                            <option value="">All years</option>
                            {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Apply
                        </button>
                        {(search || category || volume || value || year) && (
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
                                    <th>Service Requested</th>
                                    <th>Category</th>
                                    <th>Requester</th>
                                    <th>Volume</th>
                                    <th className="text-center">Value</th>
                                    <th>Logged</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id}>
                                        <td className="font-medium text-surface-900 max-w-[260px] truncate">{r.requested_service}</td>
                                        <td>
                                            <span className="inline-flex px-1.5 py-0.5 rounded-md bg-surface-100 text-surface-700 text-[10px] font-bold uppercase tracking-wider">
                                                {r.category_label}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-sm text-surface-700">{r.requester_name ?? '—'}</div>
                                            {r.requester_organization && <div className="text-[10px] text-surface-400 mt-0.5">{r.requester_organization}</div>}
                                        </td>
                                        <td className="text-xs text-surface-500">{VOLUME_LABEL[r.expected_volume] ?? r.expected_volume}</td>
                                        <td className="text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${VALUE_BADGE[r.potential_value]}`}>
                                                {r.potential_value}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-xs text-surface-500">{r.logged_date}</div>
                                            <div className="text-[10px] text-surface-400 mt-0.5">{r.logged_by}</div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/ied/service-demand/${r.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[10px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(r.id, r.requested_service)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[10px] leading-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-chart-line-up" /></div>
                                                <p className="empty-state-title">No entries yet</p>
                                                <p className="empty-state-text">Start logging services people ask for that BITAC doesn't currently offer.</p>
                                                <div className="mt-4">
                                                    <Link href="/ied/service-demand/create" className="btn-primary btn-sm">
                                                        <i className="fi fi-rr-plus text-xs leading-none" /> Log First Entry
                                                    </Link>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {logs?.links && logs.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                            {logs.links.map((l: any, i: number) => (
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
