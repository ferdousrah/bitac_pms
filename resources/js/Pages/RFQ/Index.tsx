import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';
import PdfPopupModal from '@/Components/PdfPopupModal';

const statusConfig: Record<string, { badge: string; icon: string; label: string }> = {
    draft:    { badge: 'bg-surface-100 text-surface-600 border-surface-200', icon: 'fi-rr-disk', label: 'Draft' },
    pending:  { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'fi-rr-clock', label: 'Pending' },
    quoted:   { badge: 'bg-blue-50 text-blue-700 border-blue-200',   icon: 'fi-rr-check',  label: 'Quoted' },
    rejected: { badge: 'bg-red-50 text-red-700 border-red-200',      icon: 'fi-rr-cross',  label: 'Rejected' },
};

export default function RFQIndex({ rfqs, filters, customers }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/rfqs', {
            search:      ov.search      ?? search,
            status:      ov.status      ?? filters?.status      ?? '',
            customer_id: ov.customer_id ?? filters?.customer_id ?? '',
            job_type:    ov.job_type    ?? filters?.job_type    ?? '',
        }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };

    // Drafts never reached the pipeline, so they can just be thrown away.
    const deleteDraft = (rfq: any) => {
        const label = rfq.customer_name ?? rfq.customer?.name ?? `RFQ #${rfq.id}`;
        if (!confirm(`Delete this draft for ${label}? It will be removed along with anything attached to it. This cannot be undone.`)) return;
        router.delete(`/rfqs/${rfq.id}`, { preserveScroll: true });
    };
    const clearFilters = () => { setSearch(''); router.get('/rfqs', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status || filters?.customer_id || filters?.job_type;

    // PDF popup state
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const openRfqPdf = (rfq: any) => {
        setPdfPopup({
            open: true,
            url: `/rfqs/${rfq.id}/pdf?preview=base64`,
            title: `RFQ #${rfq.id}`,
            subtitle: rfq.customer_name ?? rfq.customer?.name ?? undefined,
        });
    };

    // Stats
    const total = rfqs?.total ?? 0;
    const pendingCount = rfqs?.data?.filter((r: any) => r.status === 'pending').length ?? 0;
    const quotedCount  = rfqs?.data?.filter((r: any) => r.status === 'quoted').length ?? 0;

    return (
        <AppLayout header="RFQ — Request for Quotation">
            <div className="space-y-6 animate-fade-in">

                {/* Page header with inline KPI strip */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <h1 className="page-title">Request for Quotations</h1>
                        <p className="page-subtitle">Manage incoming job requests from customers</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/rfqs/create" className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New RFQ
                        </Link>
                    </div>
                </div>

                {/* Main card with integrated KPI rail */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg overflow-hidden">
                    {/* KPI rail — three equal cells, no floating chips */}
                    <div className="grid grid-cols-3 divide-x divide-surface-100 border-b border-surface-100 bg-gradient-to-r from-surface-50/40 via-white to-surface-50/40">
                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                            <div className="w-9 h-9 rounded-xl bg-brand-50 ring-1 ring-brand-100/60 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-document text-brand-600 text-sm leading-none" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">Total RFQs</div>
                                <div className="text-xl font-bold text-surface-900 leading-tight tabular-nums">{total}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 ring-1 ring-amber-100/80 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-clock text-amber-600 text-sm leading-none" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">Pending Review</div>
                                <div className="text-xl font-bold text-surface-900 leading-tight tabular-nums">{pendingCount}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 ring-1 ring-blue-100/80 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-check text-blue-600 text-sm leading-none" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] text-blue-700 uppercase tracking-wider font-semibold">Quoted</div>
                                <div className="text-xl font-bold text-surface-900 leading-tight tabular-nums">{quotedCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* Search + Filters */}
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by customer, ref no, item description..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Status</option>
                                <option value="draft">📝 Draft</option>
                                <option value="pending">⏳ Pending</option>
                                <option value="quoted">✅ Quoted</option>
                                <option value="rejected">❌ Rejected</option>
                            </select>
                            <select value={filters?.job_type ?? ''} onChange={e => applyFilters({ job_type: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Job Types</option>
                                <option value="regular">🛠 Regular</option>
                                <option value="rnd">🧪 R&amp;D</option>
                            </select>
                            <select value={filters?.customer_id ?? ''} onChange={e => applyFilters({ customer_id: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-44">
                                <option value="">All Customers</option>
                                {customers?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="flex items-center gap-1.5">
                                <button type="submit" className="btn-primary btn-sm"><i className="fi fi-rr-search text-xs leading-none" /> Search</button>
                                {hasFilters && <button type="button" onClick={clearFilters} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><i className="fi fi-rr-cross-small text-xs leading-none" /> Clear</button>}
                            </div>
                        </form>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        {rfqs.data?.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="RFQ #" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/rfqs" filters={filters} className="w-24" />
                                        <th className="w-32">Ref No.</th>
                                        <SortableHeader label="Customer" column="customer_id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/rfqs" filters={filters} />
                                        <th>Jobs</th>
                                        <SortableHeader label="Required By" column="required_by" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/rfqs" filters={filters} className="w-28" />
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/rfqs" filters={filters} className="w-28" />
                                        <th className="w-32 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rfqs.data.map((rfq: any) => {
                                        const st = statusConfig[rfq.status] ?? statusConfig.pending;
                                        return (
                                            <tr key={rfq.id} className="group">
                                                <td>
                                                    <Link href={`/rfqs/${rfq.id}`} className="block">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">#{rfq.id}</span>
                                                            {rfq.job_type === 'rnd' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-bold uppercase tracking-wider">
                                                                    R&amp;D
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td>
                                                    {rfq.customer_ref_no ? (
                                                        <span className="font-mono text-[11px] font-semibold text-surface-700">{rfq.customer_ref_no}</span>
                                                    ) : (
                                                        <span className="text-xs text-surface-300">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="min-w-0 max-w-[260px]">
                                                        <div className="font-semibold text-surface-900 text-sm truncate" title={rfq.customer}>{rfq.customer}</div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-surface-400 mt-0.5">
                                                            <span>{rfq.item_count} item{rfq.item_count !== 1 && 's'}</span>
                                                            {rfq.job_category && (
                                                                <>
                                                                    <span>·</span>
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-semibold uppercase tracking-wide">
                                                                        {rfq.job_category}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {rfq.items_summary?.length ? (
                                                        <div className="space-y-1">
                                                            {rfq.items_summary.slice(0, 2).map((item: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                                                                    <span className="text-surface-700 truncate max-w-[200px]" title={item.description}>{item.description}</span>
                                                                    <span className="text-surface-400 shrink-0">×{item.quantity} {item.unit}</span>
                                                                </div>
                                                            ))}
                                                            {rfq.item_count > 2 && (
                                                                <div className="text-[10px] text-brand-600 font-semibold pl-3">+{rfq.item_count - 2} more items</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-50 border border-dashed border-surface-200 text-[11px] text-surface-400 italic">
                                                            <i className="fi fi-rr-info text-[10px] leading-none" />
                                                            Item details pending
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {rfq.required_by ? (
                                                        <div className="flex items-center gap-1.5 text-xs text-surface-600">
                                                            <i className="fi fi-rr-calendar text-surface-400 leading-none" />
                                                            <span>{rfq.required_by}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-surface-300 italic">No deadline</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.badge}`}>
                                                        <i className={`fi ${st.icon} text-[10px] leading-none`} />
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={`/rfqs/${rfq.id}`} title="View RFQ details"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                        </Link>
                                                        {/* PDF preview temporarily hidden — re-enable when the export is finalised. */}
                                                        {false && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openRfqPdf(rfq)}
                                                                title="Preview PDF (download available inside)"
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                                            >
                                                                <i className="fi fi-rr-file-pdf text-sm leading-none" /> PDF
                                                            </button>
                                                        )}
                                                        {rfq.status === 'draft' && (
                                                            <>
                                                                <Link href={`/rfqs/${rfq.id}/edit`} title="Continue this draft"
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 transition-colors">
                                                                    <i className="fi fi-rr-edit text-sm leading-none" /> Continue
                                                                </Link>
                                                                <button type="button" onClick={() => deleteDraft(rfq)} title="Delete this draft"
                                                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors">
                                                                    <i className="fi fi-rr-trash text-sm leading-none" />
                                                                </button>
                                                            </>
                                                        )}
                                                        {!rfq.has_quotation && rfq.status === 'pending' && (
                                                            <Link href={`/quotations/create?rfq_id=${rfq.id}`} title="Prepare quotation for this RFQ"
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                                                                <i className="fi fi-rr-coins text-sm leading-none" /> Quote
                                                            </Link>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-document" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No RFQs match your filters' : 'No RFQs yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search or filter criteria.' : 'Create your first Request for Quotation.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 space-y-3 pt-3">
                        {rfqs.data?.length > 0 ? rfqs.data.map((rfq: any) => {
                            const st = statusConfig[rfq.status] ?? statusConfig.pending;
                            return (
                                <Link key={rfq.id} href={`/rfqs/${rfq.id}`}
                                    className="block rounded-xl border border-surface-100 bg-white p-4 space-y-3 hover:border-brand-200 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                                #{rfq.id}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-surface-900 text-sm truncate">{rfq.customer}</div>
                                                {rfq.customer_ref_no && <div className="text-[10px] text-surface-400 font-mono">{rfq.customer_ref_no}</div>}
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${st.badge}`}>
                                            <i className={`fi ${st.icon} leading-none`} /> {st.label}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {rfq.items_summary?.slice(0, 2).map((item: any, i: number) => (
                                            <div key={i} className="flex items-center gap-1.5 text-xs text-surface-600">
                                                <span className="w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                                                <span className="truncate">{item.description}</span>
                                                <span className="text-surface-400 shrink-0 ml-auto">×{item.quantity} {item.unit}</span>
                                            </div>
                                        ))}
                                        {rfq.item_count > 2 && <div className="text-[10px] text-brand-600 font-semibold pl-2.5">+{rfq.item_count - 2} more</div>}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-surface-400 pt-2 border-t border-surface-100">
                                        <span>{rfq.created_at} · {rfq.created_by}</span>
                                        {rfq.required_by && <span className="flex items-center gap-1"><i className="fi fi-rr-calendar leading-none" /> Due: {rfq.required_by}</span>}
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-document" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No RFQs yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {rfqs.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {rfqs.from}–{rfqs.to} of {rfqs.total}</div>
                            <div className="pagination-controls">
                                {rfqs.links.map((link: any, i: number) => {
                                    if (link.label.includes('Previous')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-left text-xs leading-none" /></Link>;
                                    if (link.label.includes('Next')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-right text-xs leading-none" /></Link>;
                                    return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${link.active ? 'pagination-btn-active' : ''}`} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PDF popup viewer — Download / Open in new tab buttons live inside the modal header */}
            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}
