import { Link } from '@inertiajs/react';

const STATUS_BADGE: Record<string, string> = {
    draft:              'badge-slate',
    approved:           'badge-blue',
    in_production:      'badge-amber',
    qc_hold:            'badge-amber',
    qc_passed:          'badge-green',
    ready_for_delivery: 'badge-purple',
    delivered:          'badge-green',
    cancelled:          'badge-red',
};

export default function CustomerWorkOrderIndex({ workOrders }: any) {
    const list = workOrders?.data ?? [];

    return (
        <div className="min-h-screen bg-surface-50">
            {/* Nav */}
            <nav className="bg-white border-b border-surface-100 shadow-sm sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-4">
                    <Link href="/customer/dashboard" className="btn-ghost btn-xs">
                        <i className="fi fi-rr-arrow-left leading-none text-xs" /> Dashboard
                    </Link>
                    <div className="h-5 w-px bg-surface-200" />
                    <h1 className="font-bold text-surface-900 text-sm sm:text-base">My Work Orders</h1>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-clipboard-list leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-surface-800">All Work Orders</h2>
                                <p className="text-xs text-surface-400 mt-0.5">{list.length} order{list.length === 1 ? '' : 's'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>WO Number</th>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((wo: any) => {
                                    const pct = wo.progress_pct ?? 0;
                                    const barColor =
                                        wo.status === 'cancelled' ? 'bg-surface-300' :
                                        pct >= 100                ? 'bg-emerald-500' :
                                        pct >= 70                 ? 'bg-blue-500' :
                                        pct >= 30                 ? 'bg-amber-500' :
                                                                    'bg-surface-300';
                                    return (
                                        <tr key={wo.id}>
                                            <td>
                                                <Link href={`/customer/work-orders/${wo.id}`} className="font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                                                    {wo.wo_number}
                                                </Link>
                                            </td>
                                            <td>
                                                <div className="text-surface-800 font-medium truncate max-w-[220px]">{wo.product}</div>
                                                {wo.item_count > 1 && (
                                                    <div className="text-[10px] text-indigo-700 mt-0.5 font-semibold inline-flex items-center gap-1">
                                                        <i className="fi fi-rr-boxes text-[9px] leading-none" />
                                                        +{wo.item_count - 1} more item{wo.item_count > 2 ? 's' : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="font-mono text-surface-700">{wo.quantity}</td>
                                            <td className="min-w-[140px]">
                                                {wo.status === 'cancelled' ? (
                                                    <span className="text-xs text-surface-400">—</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                                                            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(2, pct)}%` }} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-surface-700 tabular-nums w-9 text-right">{pct}%</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'}`}>
                                                    {wo.status?.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="text-surface-500">{wo.due_date ?? '—'}</td>
                                        </tr>
                                    );
                                })}
                                {list.length === 0 && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                                <p className="empty-state-title">No work orders</p>
                                                <p className="empty-state-text">You do not have any work orders yet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden card-body space-y-3">
                        {list.map((wo: any) => {
                            const pct = wo.progress_pct ?? 0;
                            const barColor =
                                wo.status === 'cancelled' ? 'bg-surface-300' :
                                pct >= 100                ? 'bg-emerald-500' :
                                pct >= 70                 ? 'bg-blue-500' :
                                pct >= 30                 ? 'bg-amber-500' :
                                                            'bg-surface-300';
                            return (
                                <Link
                                    key={wo.id}
                                    href={`/customer/work-orders/${wo.id}`}
                                    className="block rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-white hover:shadow-sm p-3.5 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-sm font-bold text-brand-600">{wo.wo_number}</span>
                                        <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'}`}>{wo.status?.replace(/_/g, ' ')}</span>
                                    </div>
                                    <p className="text-sm font-medium text-surface-800 truncate">{wo.product}</p>
                                    {wo.item_count > 1 && (
                                        <p className="text-[10px] text-indigo-700 mt-0.5 font-semibold inline-flex items-center gap-1">
                                            <i className="fi fi-rr-boxes text-[9px] leading-none" />
                                            +{wo.item_count - 1} more item{wo.item_count > 2 ? 's' : ''}
                                        </p>
                                    )}
                                    {wo.status !== 'cancelled' && (
                                        <div className="mt-2.5 flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                                                <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(2, pct)}%` }} />
                                            </div>
                                            <span className="text-[11px] font-semibold text-surface-700 tabular-nums w-9 text-right">{pct}%</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-100 text-xs">
                                        <span className="text-surface-500">Qty <span className="font-mono text-surface-700">{wo.quantity}</span></span>
                                        <span className="text-surface-500">Due {wo.due_date ?? '—'}</span>
                                    </div>
                                </Link>
                            );
                        })}
                        {list.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                <p className="empty-state-title">No work orders</p>
                                <p className="empty-state-text">You do not have any work orders yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
