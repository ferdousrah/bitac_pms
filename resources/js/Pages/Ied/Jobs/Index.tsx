import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const STATUS_DOT: Record<string, string> = {
    amber: 'bg-amber-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
    yellow: 'bg-yellow-500', orange: 'bg-orange-500', teal: 'bg-teal-500',
    green: 'bg-emerald-500', red: 'bg-rose-500', gray: 'bg-surface-400',
};

export default function IedJobsIndex({ jobs, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const applyFilters = (ov: Record<string, string> = {}) => {
        router.get('/ied/jobs', {
            search: ov.search ?? search,
            status: ov.status ?? filters?.status ?? '',
        }, { preserveState: true, replace: true });
    };
    const submitSearch = (e: React.FormEvent) => { e.preventDefault(); applyFilters(); };

    const rows = jobs?.data ?? [];

    return (
        <AppLayout header="IED — Jobs">
            <div className="space-y-5 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Jobs</h1>
                        <p className="page-subtitle">Read-only view of every Work Order past the IED gate · {jobs?.total ?? 0} jobs</p>
                    </div>
                </div>

                <div className="card">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search job#, WO#, PO no, customer…"
                                    className="form-input !pl-9 !py-2 text-sm w-full"
                                />
                            </div>
                            <select value={filters?.status ?? ''} onChange={e => applyFilters({ status: e.target.value })}
                                className="form-select !py-2 text-sm w-full sm:w-44">
                                <option value="">All Status</option>
                                <option value="pcd_pending">In Production Planning</option>
                                <option value="released_to_shops">Released to Shops</option>
                                <option value="in_production">In Production</option>
                                <option value="qc_hold">QC Hold</option>
                                <option value="qc_passed">QC Passed</option>
                                <option value="ready_for_delivery">Ready for Delivery</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <button type="submit" className="btn-primary btn-sm">
                                <i className="fi fi-rr-search text-xs leading-none" /> Search
                            </button>
                        </form>
                    </div>

                    <div className="overflow-x-auto">
                        {rows.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-32">Job #</th>
                                        <th className="w-32">WO #</th>
                                        <th>Customer</th>
                                        <th className="w-32">PO No.</th>
                                        <th className="w-24 text-right">Qty</th>
                                        <th className="w-36">Status</th>
                                        <th className="w-32">Due</th>
                                        <th className="w-24 text-right">Progress</th>
                                        <th className="w-24 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((j: any) => (
                                        <tr key={j.id} className="group">
                                            <td>
                                                {j.job_number ? (
                                                    <Link href={`/ied/jobs/${j.id}`} className="font-mono font-bold text-brand-600 group-hover:underline">
                                                        {j.job_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-[10px] text-surface-300 italic">pending</span>
                                                )}
                                            </td>
                                            <td className="font-mono text-xs text-surface-600">{j.wo_number}</td>
                                            <td>
                                                <div className="font-semibold text-surface-900 text-sm">{j.customer}</div>
                                                {j.rfq_id && <div className="text-[10px] text-surface-400">RFQ #{j.rfq_id}</div>}
                                            </td>
                                            <td>
                                                {j.customer_po_no ? (
                                                    <span className="font-mono text-xs text-surface-700">{j.customer_po_no}</span>
                                                ) : (
                                                    <span className="text-xs text-surface-300">—</span>
                                                )}
                                            </td>
                                            <td className="text-right font-mono text-sm">{j.quantity}</td>
                                            <td>
                                                <span className="inline-flex items-center gap-1.5 text-xs">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[j.status_color] ?? 'bg-surface-400'}`} />
                                                    <span className="font-semibold text-surface-700">{j.status_label}</span>
                                                </span>
                                            </td>
                                            <td>
                                                {j.due_date ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-surface-600">
                                                        <i className="fi fi-rr-calendar text-surface-400" />
                                                        {j.due_date}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-surface-300 italic">—</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <span className="font-mono text-xs text-surface-700">{Math.round(j.progress_pct ?? 0)}%</span>
                                            </td>
                                            <td className="text-right">
                                                <Link href={`/ied/jobs/${j.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800">
                                                    <i className="fi fi-rr-eye text-xs leading-none" /> View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-briefcase" /></div>
                                <div className="empty-state-title">No jobs to show</div>
                                <div className="empty-state-text">Jobs appear here once IED accepts a Work Order.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
