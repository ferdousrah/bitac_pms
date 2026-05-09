import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';

const severityBadge: Record<string, string> = {
    low: 'badge-slate',
    minor: 'badge-slate',
    medium: 'badge-amber',
    major: 'badge-amber',
    high: 'badge-red',
    critical: 'badge-red',
};

const statusBadge: Record<string, string> = {
    open: 'badge-amber',
    in_progress: 'badge-blue',
    'in-progress': 'badge-blue',
    in_rework: 'badge-blue',
    closed: 'badge-green',
    resolved: 'badge-green',
};

const formatValue = (v?: string) => (v ? v.replace(/_/g, ' ') : '--');

export default function NCRIndex({ ncrs, filters }: any) {
    const rows = ncrs?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/ncrs', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/ncrs', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status;

    const total = ncrs?.total ?? 0;

    return (
        <AppLayout header="Non-Conformance Reports">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Non-Conformance Reports</h1>
                        <p className="page-subtitle">Track defects, dispositions and corrective actions</p>
                    </div>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-triangle-warning text-brand-600 text-sm leading-none" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-surface-900 leading-none tabular-nums">{total}</div>
                            <div className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">Total</div>
                        </div>
                    </div>
                </div>

                {/* Main card */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg">
                    {/* Search + Filters */}
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by NCR number, work order, defect..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Status</option>
                                <option value="open">Open</option>
                                <option value="in_rework">In Rework</option>
                                <option value="closed">Closed</option>
                            </select>
                            <div className="flex items-center gap-1.5">
                                <button type="submit" className="btn-primary btn-sm"><i className="fi fi-rr-search text-xs leading-none" /> Search</button>
                                {hasFilters && <button type="button" onClick={clearFilters} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><i className="fi fi-rr-cross-small text-xs leading-none" /> Clear</button>}
                            </div>
                        </form>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        {rows.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="NCR #" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/ncrs" filters={filters} className="w-28" />
                                        <th>Work Order</th>
                                        <th>Defect</th>
                                        <th>Severity</th>
                                        <th>Disposition</th>
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/ncrs" filters={filters} className="w-28" />
                                        <SortableHeader label="Raised" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/ncrs" filters={filters} className="w-28" />
                                        <th className="w-24 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((ncr: any) => (
                                        <tr key={ncr.id} className="group">
                                            <td>
                                                <Link href={`/ncr/${ncr.id}`} className="font-mono font-semibold text-rose-600 group-hover:underline">
                                                    {ncr.ncr_number}
                                                </Link>
                                            </td>
                                            <td>
                                                <Link
                                                    href={`/work-orders/${ncr.work_order_id}`}
                                                    className="font-mono text-brand-600 hover:text-brand-700"
                                                >
                                                    {ncr.wo_number}
                                                </Link>
                                            </td>
                                            <td className="max-w-xs">
                                                <div className="truncate text-surface-700" title={ncr.defect_description}>
                                                    {ncr.defect_description}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                                    {ncr.severity}
                                                </span>
                                            </td>
                                            <td className="text-surface-600 capitalize">
                                                {formatValue(ncr.disposition)}
                                            </td>
                                            <td>
                                                <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                                    {formatValue(ncr.status)}
                                                </span>
                                            </td>
                                            <td className="text-xs text-surface-500">{ncr.created_at}</td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/ncr/${ncr.id}`} title="View NCR details"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                        <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-triangle-warning" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No NCRs match your filters' : 'No NCRs found'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Non-conformance reports will appear here when raised.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {rows.length > 0 ? rows.map((ncr: any) => (
                            <Link key={ncr.id} href={`/ncr/${ncr.id}`}
                                className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-rose-700 font-bold text-sm shrink-0">
                                            #{ncr.id}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-mono font-semibold text-rose-600 text-sm">{ncr.ncr_number}</div>
                                            <div className="mt-0.5">
                                                <span className="font-mono text-xs text-brand-600">{ncr.wo_number}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                            {ncr.severity}
                                        </span>
                                        <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                            {formatValue(ncr.status)}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-sm text-surface-700 line-clamp-2">{ncr.defect_description}</p>

                                <div className="flex items-center justify-between text-[10px] text-surface-400 pt-2 border-t border-surface-100">
                                    <span className="capitalize">
                                        <i className="fi fi-rr-settings text-xs leading-none mr-1" />
                                        {formatValue(ncr.disposition)}
                                    </span>
                                    <span>
                                        <i className="fi fi-rr-calendar text-xs leading-none mr-1" />
                                        {ncr.created_at}
                                    </span>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-triangle-warning" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No NCRs found'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {ncrs.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {ncrs.from}–{ncrs.to} of {ncrs.total}</div>
                            <div className="pagination-controls">
                                {ncrs.links.map((link: any, i: number) => {
                                    if (link.label.includes('Previous')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-left text-xs leading-none" /></Link>;
                                    if (link.label.includes('Next')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-right text-xs leading-none" /></Link>;
                                    return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${link.active ? 'pagination-btn-active' : ''}`} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
