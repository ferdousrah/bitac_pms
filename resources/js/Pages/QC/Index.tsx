import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';

const resultBadge: Record<string, string> = {
    pass: 'badge-green',
    fail: 'badge-red',
    partial: 'badge-amber',
    conditional: 'badge-amber',
};

const typeBadge: Record<string, string> = {
    incoming: 'badge-blue',
    in_process: 'badge-purple',
    'in-process': 'badge-purple',
    final: 'badge-slate',
};

const formatType = (t?: string) => (t ? t.replace(/_/g, ' ') : '--');

export default function QCIndex({ inspections, filters }: any) {
    const rows = inspections?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/qc', { search: ov.search ?? search, result: ov.result ?? filters?.result ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/qc', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.result;

    const total = inspections?.total ?? 0;

    return (
        <AppLayout header="QC Inspections">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Quality Control Inspections</h1>
                        <p className="page-subtitle">All incoming, in-process and final inspections</p>
                    </div>
                    <Link href="/qc/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Inspection
                    </Link>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-shield-check text-brand-600 text-sm leading-none" />
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
                                    placeholder="Search by work order, product, inspector..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.result ?? ''} onChange={e => applyFilters({ result: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Results</option>
                                <option value="pass">Ok</option>
                                <option value="fail">Not Ok</option>
                                <option value="conditional">N/A</option>
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
                                        <SortableHeader label="ID" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/qc" filters={filters} className="w-20" />
                                        <th>Job #</th>
                                        <th>Item</th>
                                        <th>Type</th>
                                        <th>Inspector</th>
                                        <SortableHeader label="Result" column="result" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/qc" filters={filters} className="w-28" />
                                        <SortableHeader label="Date" column="inspection_date" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/qc" filters={filters} className="w-28" />
                                        <th className="w-24 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((qc: any) => (
                                        <tr key={qc.id} className="group">
                                            <td>
                                                <Link href={`/qc/inspection/${qc.id}`} className="font-mono text-sm font-bold text-brand-600 group-hover:underline">
                                                    #{qc.id}
                                                </Link>
                                            </td>
                                            <td>
                                                <div className="font-bold text-surface-900">Job# {qc.job_number ?? '—'}</div>
                                                <div className="text-[11px] text-surface-400">{qc.customer ?? ''}</div>
                                            </td>
                                            <td>
                                                {qc.item ? (
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="badge badge-amber text-[10px]">Item {qc.item.sequence}</span>
                                                            {qc.sheet_number && (
                                                                <span className="text-[10px] font-mono text-surface-400">Sheet {qc.sheet_number}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-surface-700 mt-0.5 truncate max-w-[260px]">{qc.item.description ?? '—'}</div>
                                                        <div className="text-[10px] text-surface-400">qty {qc.item.quantity} {qc.item.unit}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-surface-300 text-xs italic">WO-wide (legacy)</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${typeBadge[qc.inspection_type] ?? 'badge-slate'}`}>
                                                    {formatType(qc.inspection_type)}
                                                </span>
                                            </td>
                                            <td className="text-surface-600">{qc.inspector}</td>
                                            <td>
                                                <span className={`badge ${resultBadge[qc.result] ?? 'badge-slate'}`}>
                                                    {qc.result === 'pass' ? 'Ok' : qc.result === 'fail' ? 'Not Ok' : qc.result === 'conditional' ? 'N/A' : qc.result}
                                                </span>
                                            </td>
                                            <td className="text-xs text-surface-500">{qc.inspected_at}</td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/qc/inspection/${qc.id}`} title="View inspection details"
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
                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No inspections match your filters' : 'No inspections yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Record your first QC inspection to get started.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {rows.length > 0 ? rows.map((qc: any) => (
                            <Link key={qc.id} href={`/qc/inspection/${qc.id}`}
                                className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                                #{qc.id}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-surface-900 text-sm">Job# {qc.job_number ?? '—'}</div>
                                                <div className="text-sm text-surface-700 mt-0.5 truncate">{qc.product}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge ${resultBadge[qc.result] ?? 'badge-slate'}`}>
                                        {qc.result}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`badge ${typeBadge[qc.inspection_type] ?? 'badge-slate'}`}>
                                        {formatType(qc.inspection_type)}
                                    </span>
                                    <span className="text-xs text-surface-500">
                                        <i className="fi fi-rr-user text-xs leading-none mr-1" />
                                        {qc.inspector}
                                    </span>
                                </div>

                                <div className="flex items-center justify-end pt-2 border-t border-surface-50">
                                    <div className="text-right">
                                        <div className="text-[10px] text-surface-400 uppercase">Date</div>
                                        <div className="text-xs text-surface-600">{qc.inspected_at}</div>
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No inspections yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {inspections.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {inspections.from}–{inspections.to} of {inspections.total}</div>
                            <div className="pagination-controls">
                                {inspections.links.map((link: any, i: number) => {
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
