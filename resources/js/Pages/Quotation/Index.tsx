import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';
import PdfPopupModal from '@/Components/PdfPopupModal';
import JobTypeBadge from '@/Components/JobTypeBadge';

const STATUS: Record<string, { badge: string; icon: string; label: string }> = {
    draft:              { badge: 'bg-slate-50 text-slate-700 border-slate-200',       icon: 'fi-rr-pencil',         label: 'Draft' },
    pending_approval:   { badge: 'bg-amber-50 text-amber-700 border-amber-200',      icon: 'fi-rr-clock',          label: 'Pending Approval' },
    approved:           { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-check-circle',   label: 'Approved' },
    sent_to_customer:   { badge: 'bg-purple-50 text-purple-700 border-purple-200',   icon: 'fi-rr-paper-plane',    label: 'Sent to Customer' },
    customer_accepted:  { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-handshake',      label: 'Accepted' },
    customer_rejected:  { badge: 'bg-red-50 text-red-700 border-red-200',            icon: 'fi-rr-cross-circle',   label: 'Customer Rejected' },
    revision_requested: { badge: 'bg-amber-50 text-amber-700 border-amber-200',      icon: 'fi-rr-refresh',        label: 'Revision Requested' },
    superseded:         { badge: 'bg-slate-50 text-slate-500 border-slate-200',       icon: 'fi-rr-archive',        label: 'Superseded' },
    rejected:           { badge: 'bg-red-50 text-red-700 border-red-200',            icon: 'fi-rr-cross',          label: 'Rejected' },
    converted:          { badge: 'bg-blue-50 text-blue-700 border-blue-200',          icon: 'fi-rr-transform',      label: 'Converted to WO' },
};

const fmt = (v: any) => Number(v ?? 0).toLocaleString('en-IN');

export default function QuotationIndex({ quotations, filters, customers }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/quotations', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '', customer_id: ov.customer_id ?? filters?.customer_id ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/quotations', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status || filters?.customer_id;

    // PDF popup state
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const openQuotationPdf = (q: any) => {
        setPdfPopup({
            open:     true,
            url:      `/quotations/${q.id}/pdf?preview=base64`,
            title:    `Quotation Q-${String(q.id).padStart(5, '0')} v${q.version}`,
            subtitle: q.customer_name ?? q.customer?.name ?? undefined,
        });
    };

    return (
        <AppLayout header="Quotations">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Quotations</h1>
                        <p className="page-subtitle">Manage pricing and quotation lifecycle · {quotations?.total ?? 0} records</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={`/quotations-export/excel?${new URLSearchParams({ search: filters?.search || '', status: filters?.status || '', customer_id: filters?.customer_id || '' }).toString()}`}
                            className="btn-outline btn-sm text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <i className="fi fi-rr-file-excel text-xs leading-none" /> Excel
                        </a>
                        <a href={`/quotations-export/pdf?${new URLSearchParams({ search: filters?.search || '', status: filters?.status || '', customer_id: filters?.customer_id || '' }).toString()}`}
                            className="btn-outline btn-sm text-red-700 border-red-200 hover:bg-red-50">
                            <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                        </a>
                        <Link href="/quotations/create" className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Quotation
                        </Link>
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
                                    placeholder="Search by customer, PO number, product..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-44">
                                <option value="">All Status</option>
                                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
                        {quotations.data?.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <SortableHeader label="#" column="id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} className="w-16" />
                                        <SortableHeader label="Customer / Product" column="customer_id" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} />
                                        <th className="w-24">RFQ</th>
                                        <SortableHeader label="Amount" column="total_amount" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} className="w-32 text-right" />
                                        <SortableHeader label="Ver" column="version" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} className="w-16 text-center" />
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} className="w-40" />
                                        <SortableHeader label="Created" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/quotations" filters={filters} className="w-32" />
                                        <th className="w-28 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotations.data.map((q: any) => {
                                        const st = STATUS[q.status] ?? STATUS.draft;
                                        return (
                                            <tr key={q.id} className="group">
                                                <td>
                                                    <Link href={`/quotations/${q.id}`} className="block">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">{q.id}</span>
                                                            <JobTypeBadge type={q.job_type} size="xs" onlyRnd />
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-surface-900 text-sm truncate">{q.customer}</div>
                                                        <div className="text-xs text-surface-400 truncate max-w-[200px]">{q.product}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {q.rfq_id ? (
                                                        <Link href={`/rfqs/${q.rfq_id}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium">
                                                            <i className="fi fi-rr-link-alt text-[10px] leading-none" /> #{q.rfq_id}
                                                        </Link>
                                                    ) : <span className="text-xs text-surface-300 italic">Direct</span>}
                                                </td>
                                                <td className="text-right">
                                                    <span className="font-mono text-sm font-bold text-surface-900">{fmt(q.total_amount)}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-100 text-surface-600 text-xs font-bold">
                                                        v{q.version}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.badge}`}>
                                                        <i className={`fi ${st.icon} text-[10px] leading-none`} /> {st.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="text-xs">
                                                        <div className="text-surface-700 font-medium">{q.created_by}</div>
                                                        <div className="text-[10px] text-surface-400 mt-0.5">{q.created_at}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Link href={`/quotations/${q.id}`} title="View quotation details"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={() => openQuotationPdf(q)}
                                                            title="Preview PDF (download available inside)"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                                        >
                                                            <i className="fi fi-rr-file-pdf text-sm leading-none" /> PDF
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-coins" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No quotations match your filters' : 'No quotations yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search criteria.' : 'Create your first quotation.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 pt-3 space-y-3">
                        {quotations.data?.length > 0 ? quotations.data.map((q: any) => {
                            const st = STATUS[q.status] ?? STATUS.draft;
                            return (
                                <Link key={q.id} href={`/quotations/${q.id}`}
                                    className="block rounded-xl border border-surface-100 bg-white p-4 space-y-2.5 hover:border-brand-200 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
                                                Q{q.id}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-surface-900 text-sm truncate">{q.customer}</div>
                                                <div className="text-xs text-surface-400 truncate">{q.product}</div>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${st.badge}`}>
                                            <i className={`fi ${st.icon} leading-none`} /> {st.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-lg text-surface-900">{fmt(q.total_amount)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="badge badge-slate text-[9px]">v{q.version}</span>
                                            {q.rfq_id && <span className="text-brand-600 text-[10px] font-medium">RFQ #{q.rfq_id}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-surface-400 pt-2 border-t border-surface-100">
                                        <span>{q.created_at} · {q.created_by}</span>
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-coins" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No results' : 'No quotations yet'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {quotations?.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {quotations.from}–{quotations.to} of {quotations.total}</div>
                            <div className="pagination-controls">
                                {quotations.links.map((link: any, i: number) => {
                                    if (link.label.includes('Previous')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-left text-xs leading-none" /></Link>;
                                    if (link.label.includes('Next')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-right text-xs leading-none" /></Link>;
                                    return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${link.active ? 'pagination-btn-active' : ''}`} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* PDF popup viewer — download button is inside the popup header */}
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
