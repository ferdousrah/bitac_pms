import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';
import JobTypeBadge from '@/Components/JobTypeBadge';

const STATUS: Record<string, { badge: string; icon: string }> = {
    draft:              { badge: 'bg-slate-50 text-slate-700 border-slate-200',       icon: 'fi-rr-pencil' },
    approved:           { badge: 'bg-blue-50 text-blue-700 border-blue-200',          icon: 'fi-rr-check' },
    in_production:      { badge: 'bg-amber-50 text-amber-700 border-amber-200',      icon: 'fi-rr-settings' },
    qc_hold:            { badge: 'bg-orange-50 text-orange-700 border-orange-200',    icon: 'fi-rr-shield-check' },
    qc_passed:          { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-check-circle' },
    ready_for_delivery: { badge: 'bg-purple-50 text-purple-700 border-purple-200',   icon: 'fi-rr-truck-side' },
    delivered:          { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-box' },
    cancelled:          { badge: 'bg-red-50 text-red-700 border-red-200',            icon: 'fi-rr-cross' },
};

const PRIORITY: Record<string, string> = {
    low: 'bg-slate-50 text-slate-600 border-slate-200', normal: 'bg-blue-50 text-blue-600 border-blue-200', urgent: 'bg-red-50 text-red-600 border-red-200',
};

export default function WorkOrderIndex({ workOrders, filters, statusList }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/work-orders', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '', priority: ov.priority ?? filters?.priority ?? '', sort: filters?.sort, dir: filters?.dir }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/work-orders', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status || filters?.priority;

    return (
        <AppLayout header="Jobs">
            <div className="space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Jobs</h1>
                        <p className="page-subtitle">Customer production jobs across the shop floor · {workOrders?.total ?? 0} records</p>
                    </div>
                    <Link href="/work-orders/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Job
                    </Link>
                </div>

                <div className="card transition-all duration-300 hover:shadow-premium-lg">
                    {/* Search + Filters */}
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search Job number, customer, product, PO..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-44">
                                <option value="">All Status</option>
                                {statusList?.map((s: string) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                            <select value={filters?.priority ?? ''} onChange={e => applyFilters({ priority: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-32">
                                <option value="">All Priority</option>
                                <option value="urgent">Urgent</option>
                                <option value="normal">Normal</option>
                                <option value="low">Low</option>
                            </select>
                            <div className="flex items-center gap-1.5">
                                <button type="submit" className="btn-primary btn-sm"><i className="fi fi-rr-search text-xs leading-none" /> Search</button>
                                {hasFilters && <button type="button" onClick={clearFilters} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><i className="fi fi-rr-cross-small text-xs leading-none" /> Clear</button>}
                            </div>
                        </form>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        {workOrders.data?.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="Job Number" column="job_number" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/work-orders" filters={filters} className="w-32" />
                                        <th>Product / Customer</th>
                                        <SortableHeader label="Qty" column="quantity" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/work-orders" filters={filters} className="w-16 text-right" />
                                        <th className="w-24">Progress</th>
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/work-orders" filters={filters} className="w-36" />
                                        <SortableHeader label="Priority" column="priority" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/work-orders" filters={filters} className="w-24" />
                                        <SortableHeader label="Due Date" column="due_date" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/work-orders" filters={filters} className="w-28" />
                                        <th className="w-20 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workOrders.data.map((wo: any) => {
                                        const st = STATUS[wo.status] ?? STATUS.draft;
                                        return (
                                            <tr key={wo.id} className={`group ${wo.is_overdue ? 'bg-red-50/40' : ''}`}>
                                                <td>
                                                    <Link href={`/work-orders/${wo.id}`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">{wo.job_number ?? wo.wo_number}</span>
                                                            <JobTypeBadge type={wo.job_type} size="xs" onlyRnd />
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="font-semibold text-surface-900 text-sm">{wo.product}</div>
                                                    <div className="text-xs text-surface-400">{wo.customer}</div>
                                                </td>
                                                <td className="text-right font-bold text-surface-700">{wo.quantity}</td>
                                                <td>
                                                    {wo.progress_pct !== null ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden max-w-[60px]">
                                                                <div className="h-full rounded-full transition-all" style={{
                                                                    width: `${wo.progress_pct}%`,
                                                                    background: wo.progress_pct >= 100 ? '#10b981' : wo.progress_pct >= 50 ? '#f59e0b' : '#94a3b8',
                                                                }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold tabular-nums text-surface-600 w-8">{wo.progress_pct}%</span>
                                                        </div>
                                                    ) : <span className="text-[10px] text-surface-300">—</span>}
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.badge}`}>
                                                        <i className={`fi ${st.icon} text-[10px] leading-none`} /> {wo.status_label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${PRIORITY[wo.priority] ?? PRIORITY.normal}`}>
                                                        {wo.priority}
                                                    </span>
                                                </td>
                                                <td>
                                                    {wo.is_overdue ? (
                                                        <span className="flex items-center gap-1 text-red-600 font-semibold text-xs">
                                                            <i className="fi fi-rr-clock text-xs leading-none" /> {wo.due_date}
                                                        </span>
                                                    ) : wo.due_date ? (
                                                        <span className="flex items-center gap-1 text-xs text-surface-600">
                                                            <i className="fi fi-rr-calendar text-surface-400 leading-none" /> {wo.due_date}
                                                        </span>
                                                    ) : <span className="text-xs text-surface-300 italic">No deadline</span>}
                                                </td>
                                                <td>
                                                    <Link href={`/work-orders/${wo.id}`} title="View work order details"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                        <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-box" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No work orders match' : 'No work orders yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different criteria.' : 'Create a new work order to begin.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 pt-3 space-y-3">
                        {workOrders.data?.length > 0 ? workOrders.data.map((wo: any) => {
                            const st = STATUS[wo.status] ?? STATUS.draft;
                            return (
                                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                                    className={`block rounded-xl border bg-white p-4 space-y-2.5 hover:border-brand-200 hover:shadow-md transition-all ${wo.is_overdue ? 'border-red-200 bg-red-50/30' : 'border-surface-100'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-sm font-bold text-brand-600">{wo.job_number ?? wo.wo_number}</span>
                                                <JobTypeBadge type={wo.job_type} size="xs" onlyRnd />
                                            </div>
                                            <div className="font-semibold text-surface-900 text-sm mt-0.5">{wo.product}</div>
                                            <div className="text-xs text-surface-400">{wo.customer}</div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${st.badge}`}>
                                            <i className={`fi ${st.icon} leading-none`} /> {wo.status_label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-surface-400 pt-2 border-t border-surface-100">
                                        <div className="flex items-center gap-3">
                                            <span>Qty: <strong className="text-surface-700">{wo.quantity}</strong></span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${PRIORITY[wo.priority] ?? PRIORITY.normal}`}>{wo.priority}</span>
                                        </div>
                                        {wo.due_date && <span className={wo.is_overdue ? 'text-red-600 font-semibold' : ''}>{wo.due_date}</span>}
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-box" /></div>
                                <div className="empty-state-title">No work orders</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {workOrders?.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {workOrders.from}–{workOrders.to} of {workOrders.total}</div>
                            <div className="pagination-controls">
                                {workOrders.links.map((link: any, i: number) => {
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
