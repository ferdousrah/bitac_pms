import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function IedWorkOrdersInbox({ workOrders, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/ied/work-orders', { search }, { preserveState: true, replace: true });
    };

    const rows = workOrders?.data ?? [];

    return (
        <AppLayout header="IED — Work Order Inbox">
            <div className="space-y-5 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Work Order Inbox</h1>
                        <p className="page-subtitle">Review work orders before they go to PCD · {workOrders?.total ?? 0} pending</p>
                    </div>
                </div>

                <div className="card">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={submitSearch} className="flex gap-2">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search WO no, job no, PO no, customer…"
                                    className="form-input !pl-9 !py-2 text-sm w-full"
                                />
                            </div>
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
                                        <th className="w-32">WO #</th>
                                        <th className="w-32">Job #</th>
                                        <th>Customer</th>
                                        <th className="w-32">PO No.</th>
                                        <th className="w-24 text-right">Qty</th>
                                        <th className="w-32">Due Date</th>
                                        <th className="w-32">Source</th>
                                        <th className="w-28 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((wo: any) => (
                                        <tr key={wo.id} className="group">
                                            <td>
                                                <Link href={`/ied/work-orders/${wo.id}`} className="font-mono font-bold text-brand-600 group-hover:underline text-sm">
                                                    {wo.wo_number}
                                                </Link>
                                            </td>
                                            <td>
                                                {wo.job_number ? (
                                                    <span className="font-mono text-xs text-surface-700">{wo.job_number}</span>
                                                ) : (
                                                    <span className="text-[10px] text-surface-300 italic">pending</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="font-semibold text-surface-900 text-sm">{wo.customer_name}</div>
                                                {wo.rfq_id && <div className="text-[10px] text-surface-400">RFQ #{wo.rfq_id}</div>}
                                            </td>
                                            <td>
                                                {wo.customer_po_no ? (
                                                    <span className="font-mono text-xs text-surface-700">{wo.customer_po_no}</span>
                                                ) : (
                                                    <span className="text-xs text-surface-300">—</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <span className="font-mono text-sm">{wo.quantity}</span>
                                            </td>
                                            <td>
                                                {wo.due_date ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-surface-600">
                                                        <i className="fi fi-rr-calendar text-surface-400" />
                                                        {wo.due_date}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-surface-300 italic">—</span>
                                                )}
                                            </td>
                                            <td>
                                                {wo.source === 'customer_portal' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold uppercase">
                                                        <i className="fi fi-rr-building text-[9px]" /> Customer
                                                    </span>
                                                ) : (
                                                    <div className="text-xs">
                                                        <div className="text-surface-700 font-medium">{wo.created_by ?? '—'}</div>
                                                        <div className="text-[10px] text-surface-400">{wo.created_at}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <Link href={`/ied/work-orders/${wo.id}`} className="btn-primary btn-xs">
                                                    <i className="fi fi-rr-eye text-xs leading-none" /> Review
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-inbox" /></div>
                                <div className="empty-state-title">Inbox is empty</div>
                                <div className="empty-state-text">No work orders are awaiting IED review right now.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
