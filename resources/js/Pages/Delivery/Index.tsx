import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';
import PdfPopupModal from '@/Components/PdfPopupModal';

const statusBadge: Record<string, string> = {
    pending: 'badge-amber',
    scheduled: 'badge-amber',
    dispatched: 'badge-blue',
    in_transit: 'badge-blue',
    delivered: 'badge-green',
    returned: 'badge-red',
};

export default function DeliveryIndex({ deliveries, filters }: any) {
    const list = deliveries?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/delivery', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/delivery', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status;

    const total = deliveries?.total ?? 0;

    return (
        <AppLayout header="Delivery Orders">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Delivery Orders</h1>
                        <p className="page-subtitle">Track shipments and delivery status across work orders</p>
                    </div>
                    <Link href="/delivery/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Delivery
                    </Link>
                </div>

                {/* Quick stat chips */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-surface-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                            <i className="fi fi-rr-truck-side text-brand-600 text-sm leading-none" />
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
                                    placeholder="Search by challan no, work order, customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Status</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="dispatched">Dispatched</option>
                                <option value="delivered">Delivered</option>
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
                                        <SortableHeader label="ID" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/delivery" filters={filters} className="w-20" />
                                        <th>Challan No.</th>
                                        <th>Work Order</th>
                                        <th>Customer</th>
                                        <th>Qty</th>
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/delivery" filters={filters} className="w-28" />
                                        <SortableHeader label="Scheduled" column="scheduled_date" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/delivery" filters={filters} className="w-28" />
                                        <th>Delivered</th>
                                        <SortableHeader label="Created" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/delivery" filters={filters} className="w-28" />
                                        <th className="w-36 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.map((d: any) => (
                                        <tr key={d.id} className="group">
                                            <td>
                                                <Link href={`/delivery/${d.id}`} className="font-mono text-sm font-bold text-brand-600 group-hover:underline">
                                                    #{d.id}
                                                </Link>
                                            </td>
                                            <td>
                                                <span className="font-mono font-semibold text-brand-600">
                                                    {d.challan_number}
                                                </span>
                                            </td>
                                            <td>
                                                <Link
                                                    href={`/work-orders/${d.work_order_id}`}
                                                    className="font-mono text-sm text-brand-600 hover:underline"
                                                >
                                                    {d.wo_number}
                                                </Link>
                                            </td>
                                            <td className="font-semibold text-surface-900">{d.customer}</td>
                                            <td className="font-mono text-surface-700">
                                                {d.quantity_delivered}
                                            </td>
                                            <td>
                                                <span className={`badge ${statusBadge[d.status] ?? 'badge-slate'}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td className="text-surface-600 text-xs">
                                                {d.scheduled_date ?? <span className="text-surface-300">--</span>}
                                            </td>
                                            <td className="text-surface-600 text-xs">
                                                {d.delivered_at ?? <span className="text-surface-300">--</span>}
                                            </td>
                                            <td className="text-xs text-surface-500">{d.created_at}</td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/delivery/${d.id}`} title="View delivery details"
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                        <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        title="Preview Challan PDF"
                                                        onClick={() => setPdfPopup({
                                                            open: true,
                                                            url: `/delivery/${d.id}/pdf?preview=base64`,
                                                            title: `Challan ${d.challan_number}`,
                                                            subtitle: d.work_order_number,
                                                        })}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors">
                                                        <i className="fi fi-rr-file-pdf text-sm leading-none" /> PDF
                                                    </button>
                                                    {d.status !== 'delivered' && (
                                                        <Link href={`/delivery/${d.id}/complete`} title="Mark delivery as complete"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                                                            <i className="fi fi-rr-check text-sm leading-none" /> Complete
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
                                <div className="empty-state-icon"><i className="fi fi-rr-truck-side" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No deliveries match your filters' : 'No deliveries yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Create a delivery order to dispatch a completed work order.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {list.length > 0 ? list.map((d: any) => (
                            <Link key={d.id} href={`/delivery/${d.id}`}
                                className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                            #{d.id}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-mono font-semibold text-brand-600 text-sm">{d.challan_number}</div>
                                            <div className="font-semibold text-surface-900 text-sm mt-0.5">{d.customer}</div>
                                            <Link href={`/work-orders/${d.work_order_id}`} className="font-mono text-xs text-brand-600 hover:underline"
                                                onClick={e => e.stopPropagation()}>
                                                {d.wo_number}
                                            </Link>
                                        </div>
                                    </div>
                                    <span className={`badge ${statusBadge[d.status] ?? 'badge-slate'}`}>
                                        {d.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <div className="text-surface-400">Qty</div>
                                        <div className="font-mono font-semibold text-surface-700">{d.quantity_delivered}</div>
                                    </div>
                                    <div>
                                        <div className="text-surface-400">Scheduled</div>
                                        <div className="text-surface-700">{d.scheduled_date ?? '--'}</div>
                                    </div>
                                    <div>
                                        <div className="text-surface-400">Delivered</div>
                                        <div className="text-surface-700">{d.delivered_at ?? '--'}</div>
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-truck-side" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No deliveries yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {deliveries.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {deliveries.from}–{deliveries.to} of {deliveries.total}</div>
                            <div className="pagination-controls">
                                {deliveries.links.map((link: any, i: number) => {
                                    if (link.label.includes('Previous')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-left text-xs leading-none" /></Link>;
                                    if (link.label.includes('Next')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-right text-xs leading-none" /></Link>;
                                    return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${link.active ? 'pagination-btn-active' : ''}`} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.open ? pdfPopup.url : null}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}
