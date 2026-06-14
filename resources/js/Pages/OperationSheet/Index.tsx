import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';

export default function OperationSheetIndex({ sheets, filters }: any) {
    const rows = sheets?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/operation-sheets', { search: ov.search ?? search }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/operation-sheets', {}, { preserveState: true, replace: true }); };
    const hasFilters = !!search;

    const total = sheets?.total ?? 0;

    return (
        <AppLayout header="Operation Sheets">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Operation Sheets</h1>
                        <p className="page-subtitle">All operation sheets across work orders</p>
                    </div>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-document text-brand-600 text-sm leading-none" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-surface-900 leading-none tabular-nums">{total}</div>
                            <div className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">Total</div>
                        </div>
                    </div>
                </div>

                {/* Main card */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg">
                    {/* Search */}
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by sheet number, work order, customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
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
                                        <SortableHeader label="Sheet #" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/operation-sheets" filters={filters} className="w-28" />
                                        <th>Job #</th>
                                        <th>Customer</th>
                                        <th>Product</th>
                                        <th>Steps</th>
                                        <SortableHeader label="Created" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/operation-sheets" filters={filters} className="w-28" />
                                        <th className="w-24 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((s: any) => (
                                        <tr key={s.id} className="group">
                                            <td>
                                                <Link href={`/operation-sheets/${s.id}`} className="font-mono font-semibold text-brand-600 group-hover:underline">
                                                    {s.sheet_number}
                                                </Link>
                                            </td>
                                            <td>
                                                {s.work_order ? (
                                                    <div className="font-bold text-surface-900 text-sm">
                                                        Job# {s.work_order.job_number ?? '—'}
                                                    </div>
                                                ) : (
                                                    <span className="text-surface-300">—</span>
                                                )}
                                            </td>
                                            <td className="text-surface-700">{s.work_order?.customer ?? '—'}</td>
                                            <td className="text-surface-600">{s.item?.description ?? s.work_order?.product ?? '—'}</td>
                                            <td>
                                                <span className="badge badge-slate">{s.step_count} step{s.step_count !== 1 && 's'}</span>
                                            </td>
                                            <td className="text-xs text-surface-500">{s.created_at}</td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/operation-sheets/${s.id}`} title="View operation sheet"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                        <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                    </Link>
                                                    <Link href={`/operation-sheets/${s.id}/edit`} title="Edit operation sheet"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors">
                                                        <i className="fi fi-rr-edit text-sm leading-none" /> Edit
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-document" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No operation sheets match your search' : 'No operation sheets yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search criteria.' : 'Operation sheets are created from work orders in the PCD module.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {rows.length > 0 ? rows.map((s: any) => (
                            <Link key={s.id} href={`/operation-sheets/${s.id}`}
                                className="block rounded-xl border border-surface-100 bg-white p-4 space-y-2 hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                            #{s.id}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-mono font-semibold text-brand-600 text-sm">{s.sheet_number}</span>
                                            {s.work_order && (
                                                <div className="text-xs text-surface-600 mt-0.5">
                                                    Job# <span className="font-bold text-surface-800">{s.work_order.job_number ?? '—'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="badge badge-slate text-[10px]">{s.step_count} steps</span>
                                </div>
                                {s.work_order?.customer && (
                                    <div className="text-sm text-surface-700">{s.work_order.customer}</div>
                                )}
                                <div className="flex items-center text-xs pt-2 border-t border-surface-100">
                                    <span className="text-surface-500">{s.created_at}</span>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-document" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No operation sheets yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {sheets.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {sheets.from}–{sheets.to} of {sheets.total}</div>
                            <div className="pagination-controls">
                                {sheets.links.map((link: any, i: number) => {
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
