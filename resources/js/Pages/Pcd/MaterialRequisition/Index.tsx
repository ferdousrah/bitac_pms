import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    pending_approval: 'badge-amber',
    approved: 'badge-blue',
    partially_issued: 'badge-amber',
    issued: 'badge-green',
    received: 'badge-green',
    cancelled: 'badge-red',
};

const statusLabel: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    partially_issued: 'Partially Issued',
    issued: 'Issued',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function MaterialRequisitionIndex({ requisitions, filters }: any) {
    const rows = requisitions?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');

    const baseUrl = '/pcd/material-requisitions';

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get(baseUrl, { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get(baseUrl, {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status;

    const total = requisitions?.total ?? 0;

    return (
        <AppLayout header="Material Requisitions">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Material Requisitions</h1>
                        <p className="page-subtitle">Request materials from stores against work orders (MRN)</p>
                    </div>
                    <Link href={`${baseUrl}/create`} className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Requisition
                    </Link>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-clipboard-list text-brand-600 text-sm leading-none" />
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
                                    placeholder="Search by MRN number, work order, customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-44">
                                <option value="">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="pending_approval">Pending Approval</option>
                                <option value="approved">Approved</option>
                                <option value="partially_issued">Partially Issued</option>
                                <option value="issued">Issued</option>
                                <option value="received">Received</option>
                                <option value="cancelled">Cancelled</option>
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
                                        <SortableHeader label="MRN #" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl={baseUrl} filters={filters} className="w-28" />
                                        <th>Job #</th>
                                        <th>Customer</th>
                                        <th className="text-center">Items</th>
                                        <th>Requested By</th>
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl={baseUrl} filters={filters} className="w-32" />
                                        <SortableHeader label="Request Date" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl={baseUrl} filters={filters} className="w-28" />
                                        <th className="w-36 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r: any) => (
                                        <tr key={r.id} className="group">
                                            <td>
                                                <Link href={`${baseUrl}/${r.id}`} className="font-mono font-semibold text-brand-600 group-hover:underline">
                                                    {r.mrn_number}
                                                </Link>
                                            </td>
                                            <td>
                                                {r.work_order ? (
                                                    <Link
                                                        href={`/work-orders/${r.work_order.id}`}
                                                        className="font-bold text-surface-900 hover:text-brand-600"
                                                    >
                                                        {r.work_order.job_number ?? '—'}
                                                    </Link>
                                                ) : (
                                                    <span className="text-surface-300">--</span>
                                                )}
                                                {r.work_order?.wo_number && (
                                                    <div className="text-[11px] text-surface-400 mt-0.5 font-mono">
                                                        {r.work_order.wo_number}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-surface-600">
                                                {r.work_order?.customer ?? <span className="text-surface-300">--</span>}
                                            </td>
                                            <td className="text-center font-semibold text-surface-700">
                                                {r.item_count}
                                            </td>
                                            <td className="text-surface-600">{r.requested_by ?? '--'}</td>
                                            <td>
                                                <span className={`badge ${statusBadge[r.status] ?? 'badge-slate'}`}>
                                                    {statusLabel[r.status] ?? r.status}
                                                </span>
                                            </td>
                                            <td className="text-surface-600 text-xs">{r.request_date}</td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`${baseUrl}/${r.id}`} title="View requisition details"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                        <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                    </Link>
                                                    {['draft', 'pending_approval'].includes(r.status) && (
                                                        <Link href={`${baseUrl}/${r.id}/edit`} title="Edit requisition"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                            <i className="fi fi-rr-edit text-sm leading-none" /> Edit
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No requisitions match your filters' : 'No material requisitions yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Create a requisition to request raw materials from stores against a work order.'}</div>
                                {!hasFilters && (
                                    <div className="mt-4">
                                        <Link href={`${baseUrl}/create`} className="btn-primary btn-sm">
                                            <i className="fi fi-rr-plus text-xs leading-none" /> New Requisition
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {rows.length > 0 ? rows.map((r: any) => (
                            <Link key={r.id} href={`${baseUrl}/${r.id}`}
                                className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                            #{r.id}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-mono font-semibold text-brand-600 text-sm">{r.mrn_number}</div>
                                            <div className="text-xs text-surface-500 mt-1">
                                                Job #<span className="font-bold text-surface-800">{r.work_order?.job_number ?? '--'}</span>
                                            </div>
                                            <div className="text-xs text-surface-500 mt-0.5 truncate">{r.work_order?.customer ?? '--'}</div>
                                        </div>
                                    </div>
                                    <span className={`badge ${statusBadge[r.status] ?? 'badge-slate'}`}>
                                        {statusLabel[r.status] ?? r.status}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-surface-400 pt-2 border-t border-surface-100">
                                    <span>
                                        <i className="fi fi-rr-box text-xs leading-none mr-1" />
                                        {r.item_count} items
                                    </span>
                                    <span>
                                        <i className="fi fi-rr-calendar text-xs leading-none mr-1" />
                                        {r.request_date}
                                    </span>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No material requisitions yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {requisitions.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {requisitions.from}–{requisitions.to} of {requisitions.total}</div>
                            <div className="pagination-controls">
                                {requisitions.links.map((link: any, i: number) => {
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
