import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import SortableHeader from '@/Components/SortableHeader';
import PdfPopupModal from '@/Components/PdfPopupModal';
import JobTypeBadge from '@/Components/JobTypeBadge';

const STATUS: Record<string, { badge: string; icon: string; label: string }> = {
    draft:     { badge: 'bg-slate-50 text-slate-700 border-slate-200',     icon: 'fi-rr-pencil',        label: 'Draft' },
    finalized: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-check-circle', label: 'Finalized' },
    used:      { badge: 'bg-blue-50 text-blue-700 border-blue-200',         icon: 'fi-rr-link-alt',      label: 'Used' },
};

const GROUP_COLOR: Record<string, string> = {
    A: 'bg-brand-50 text-brand-700 border-brand-200',
    B: 'bg-blue-50 text-blue-700 border-blue-200',
    C: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fmt = (v: any) => Number(v ?? 0).toLocaleString('en-IN');

export default function CostEstimateIndex({ estimates, filters }: any) {
    const rows = estimates?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');
    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/cost-estimates', { search: ov.search ?? search, status: ov.status ?? filters?.status ?? '', pricing_group: ov.pricing_group ?? filters?.pricing_group ?? '' }, { preserveState: true, replace: true });
    };
    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };
    const clearFilters = () => { setSearch(''); router.get('/cost-estimates', {}, { preserveState: true, replace: true }); };
    const hasFilters = search || filters?.status || filters?.pricing_group;

    // PDF popup state
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const openEstimatePdf = (e: any) => {
        setPdfPopup({
            open:     true,
            url:      `/cost-estimates/${e.id}/pdf?preview=base64`,
            title:    `Cost Estimate ${e.estimate_no}`,
            subtitle: e.job_name ?? e.customer?.name ?? undefined,
        });
    };

    return (
        <AppLayout header="Cost Estimates">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Job Costing Estimates</h1>
                        <p className="page-subtitle">IED cost calculation worksheets · {estimates?.total ?? 0} records</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={`/cost-estimates-export/excel?${new URLSearchParams({ search: filters?.search || '', status: filters?.status || '', pricing_group: filters?.pricing_group || '' }).toString()}`}
                            className="btn-outline btn-sm text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <i className="fi fi-rr-file-excel text-xs leading-none" /> Excel
                        </a>
                        <a href={`/cost-estimates-export/pdf?${new URLSearchParams({ search: filters?.search || '', status: filters?.status || '', pricing_group: filters?.pricing_group || '' }).toString()}`}
                            className="btn-outline btn-sm text-red-700 border-red-200 hover:bg-red-50">
                            <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                        </a>
                        <Link href="/cost-estimates/create" className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Estimate
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
                                    placeholder="Search estimate #, job name, customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-36">
                                <option value="">All Status</option>
                                <option value="draft">📝 Draft</option>
                                <option value="finalized">✅ Finalized</option>
                                <option value="used">🔗 Used</option>
                            </select>
                            <select value={filters?.pricing_group ?? ''} onChange={e => applyFilters({ pricing_group: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-32">
                                <option value="">All Groups</option>
                                <option value="A">Group A</option>
                                <option value="B">Group B</option>
                                <option value="C">Group C</option>
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
                                        <SortableHeader label="Estimate #" column="estimate_no" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} className="w-36" />
                                        <SortableHeader label="Job / Customer" column="job_name" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} />
                                        <SortableHeader label="Group" column="pricing_group" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} className="w-20 text-center" />
                                        <SortableHeader label="Grand Total" column="grand_total" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} className="w-36 text-right" />
                                        <SortableHeader label="Status" column="status" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} className="w-28" />
                                        <SortableHeader label="Created" column="created_at" currentSort={filters?.sort} currentDir={filters?.dir} baseUrl="/cost-estimates" filters={filters} className="w-32" />
                                        <th className="w-28 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((e: any) => {
                                        const st = STATUS[e.status] ?? STATUS.draft;
                                        const gc = GROUP_COLOR[e.pricing_group] ?? GROUP_COLOR.A;
                                        return (
                                            <tr key={e.id} className="group">
                                                <td>
                                                    <Link href={`/cost-estimates/${e.id}`} className="block">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">{e.estimate_no}</span>
                                                            <JobTypeBadge type={e.job_type} size="xs" onlyRnd />
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="font-semibold text-surface-900 text-sm">{e.job_name}</div>
                                                    <div className="text-xs text-surface-400 mt-0.5">{e.customer ?? e.company_name ?? '—'}</div>
                                                    {e.rfq_id && (
                                                        <div className="mt-1 flex items-center gap-1.5">
                                                            <Link href={`/rfqs/${e.rfq_id}`} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1">
                                                                <i className="fi fi-rr-link text-[9px] leading-none" /> RFQ #{e.rfq_id}
                                                            </Link>
                                                            {e.rfq_item_desc && (
                                                                <span className="text-[10px] text-surface-400 truncate max-w-[200px]" title={e.rfq_item_desc}>
                                                                    · {e.rfq_item_desc}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold border ${gc}`}>
                                                        {e.pricing_group}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <span className="font-mono text-sm font-bold text-surface-900">{fmt(e.grand_total)}</span>
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${st.badge}`}>
                                                        <i className={`fi ${st.icon} text-[10px] leading-none`} /> {st.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="text-xs">
                                                        <div className="text-surface-700 font-medium">{e.created_by}</div>
                                                        <div className="text-[10px] text-surface-400 mt-0.5">{e.created_at}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={`/cost-estimates/${e.id}`} title="View details"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                        </Link>
                                                        <Link href={`/cost-estimates/${e.id}/edit`} title="Edit estimate"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                                            <i className="fi fi-rr-pencil text-sm leading-none" /> Edit
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEstimatePdf(e)}
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
                                <div className="empty-state-icon"><i className="fi fi-rr-calculator" /></div>
                                <div className="empty-state-title">{hasFilters ? 'No estimates match your filters' : 'No cost estimates yet'}</div>
                                <div className="empty-state-text">{hasFilters ? 'Try different search criteria.' : 'Create your first job costing estimate.'}</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 pt-3 space-y-3">
                        {rows.map((e: any) => {
                            const st = STATUS[e.status] ?? STATUS.draft;
                            const gc = GROUP_COLOR[e.pricing_group] ?? GROUP_COLOR.A;
                            return (
                                <Link key={e.id} href={`/cost-estimates/${e.id}`}
                                    className="block rounded-xl border border-surface-100 bg-white p-4 space-y-2.5 hover:border-brand-200 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs font-bold text-brand-600">{e.estimate_no}</span>
                                            <div className="font-bold text-surface-900 text-sm mt-0.5 truncate">{e.job_name}</div>
                                            <div className="text-xs text-surface-400">{e.customer ?? e.company_name ?? '—'}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold border ${gc}`}>{e.pricing_group}</span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${st.badge}`}>
                                                <i className={`fi ${st.icon} leading-none`} /> {st.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                                        <span className="text-[10px] text-surface-400">{e.created_at} · {e.created_by}</span>
                                        <span className="font-mono font-bold text-surface-900">{fmt(e.grand_total)}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {estimates?.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {estimates.from}–{estimates.to} of {estimates.total}</div>
                            <div className="pagination-controls">
                                {estimates.links.map((link: any, i: number) => {
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
