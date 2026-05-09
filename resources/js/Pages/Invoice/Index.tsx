import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    issued: 'badge-blue',
    sent: 'badge-blue',
    acknowledged: 'badge-blue',
    paid: 'badge-green',
    overdue: 'badge-red',
};

const formatCurrency = (amount: any) => `৳${Number(amount).toLocaleString('en-IN')}`;

export default function InvoiceIndex({ invoices, filters }: any) {
    const list = invoices?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/invoices', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/invoices', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status;

    const total = invoices?.total ?? 0;

    return (
        <AppLayout header="Invoices">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Invoices</h1>
                        <p className="page-subtitle">Track billing status and payment collection</p>
                    </div>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-file-invoice text-brand-600 text-sm leading-none" />
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
                                    placeholder="Search by invoice no, work order, customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="issued">Issued</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="paid">Paid</option>
                            </select>
                            <div className="flex items-center gap-1.5">
                                <button type="submit" className="btn-primary btn-sm"><i className="fi fi-rr-search text-xs leading-none" /> Search</button>
                                {hasFilters && <button type="button" onClick={clearFilters} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><i className="fi fi-rr-cross-small text-xs leading-none" /> Clear</button>}
                            </div>
                        </form>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        {list.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="Invoice #" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/invoices" filters={filters} className="w-28" />
                                        <th>Work Order</th>
                                        <th>Customer</th>
                                        <SortableHeader label="Amount" column="total_amount" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/invoices" filters={filters} className="w-32" />
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/invoices" filters={filters} className="w-28" />
                                        <th>Issued</th>
                                        <th>Due Date</th>
                                        <SortableHeader label="Created" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/invoices" filters={filters} className="w-28" />
                                        <th className="w-24 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((inv: any) => {
                                        const displayStatus =
                                            inv.is_overdue && inv.status !== 'paid' ? 'overdue' : inv.status;
                                        return (
                                            <tr key={inv.id} className="group">
                                                <td>
                                                    <Link href={`/invoices/${inv.id}`} className="block">
                                                        <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">
                                                            {inv.invoice_number}
                                                        </span>
                                                    </Link>
                                                </td>
                                                <td>
                                                    <Link
                                                        href={`/work-orders/${inv.work_order_id}`}
                                                        className="font-mono text-sm text-brand-600 hover:underline"
                                                    >
                                                        {inv.wo_number}
                                                    </Link>
                                                </td>
                                                <td className="font-semibold text-surface-900">
                                                    {inv.customer}
                                                </td>
                                                <td className="font-mono font-semibold text-surface-900">
                                                    {formatCurrency(inv.total_amount)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${statusBadge[displayStatus] ?? 'badge-slate'}`}
                                                    >
                                                        {displayStatus}
                                                    </span>
                                                </td>
                                                <td className="text-surface-600 text-xs">
                                                    {inv.issued_date ?? <span className="text-surface-300">--</span>}
                                                </td>
                                                <td className="text-surface-600 text-xs">
                                                    {inv.due_date ?? <span className="text-surface-300">--</span>}
                                                </td>
                                                <td className="text-xs text-surface-500">{inv.created_at}</td>
                                                <td>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={`/invoices/${inv.id}`} title="View invoice details"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-file-invoice" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No invoices match your filters' : 'No invoices yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Invoices are generated once a work order is delivered.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {list.length > 0 ? list.map((inv: any) => {
                            const displayStatus =
                                inv.is_overdue && inv.status !== 'paid' ? 'overdue' : inv.status;
                            return (
                                <Link key={inv.id} href={`/invoices/${inv.id}`}
                                    className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                                #{inv.id}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-mono font-semibold text-surface-900 text-sm">{inv.invoice_number}</div>
                                                <div className="font-semibold text-surface-900 text-sm mt-0.5 truncate">{inv.customer}</div>
                                                <span className="font-mono text-xs text-brand-600">{inv.wo_number}</span>
                                            </div>
                                        </div>
                                        <span className={`badge ${statusBadge[displayStatus] ?? 'badge-slate'}`}>
                                            {displayStatus}
                                        </span>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="text-xs text-surface-500">
                                            <div>Issued: {inv.issued_date ?? '--'}</div>
                                            <div>Due: {inv.due_date ?? '--'}</div>
                                        </div>
                                        <div className="font-mono font-bold text-surface-900">
                                            {formatCurrency(inv.total_amount)}
                                        </div>
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-file-invoice" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No invoices yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {invoices.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {invoices.from}–{invoices.to} of {invoices.total}</div>
                            <div className="pagination-controls">
                                {invoices.links.map((link: any, i: number) => {
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
