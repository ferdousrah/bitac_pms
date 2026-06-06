import { Link, router } from '@inertiajs/react';
import CustomerLayout from '@/Layouts/CustomerLayout';

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

const STAT_CARDS = [
    { key: 'active_orders',      label: 'Active Orders',      href: '/customer/work-orders',                          icon: 'fi-rr-clipboard-list', gradient: 'from-blue-400 to-blue-600' },
    { key: 'in_production',      label: 'In Production',      href: '/customer/work-orders?status=in_production',     icon: 'fi-rr-settings',       gradient: 'from-amber-400 to-amber-600' },
    { key: 'ready_for_delivery', label: 'Ready for Delivery', href: '/customer/work-orders?status=ready_for_delivery',icon: 'fi-rr-truck-side',     gradient: 'from-emerald-400 to-emerald-600' },
    { key: 'unpaid_invoices',    label: 'Unpaid Invoices',    href: '/customer/invoices',                             icon: 'fi-rr-receipt',        gradient: 'from-red-400 to-red-600' },
];

export default function CustomerDashboard({ customer, stats, recentOrders, recentInvoices }: any) {
    return (
        <CustomerLayout>
            <div className="space-y-6 animate-fade-in">
                {/* Welcome header */}
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-surface-900">Welcome, {customer?.contact_person ?? customer?.name}</h1>
                    <p className="text-sm text-surface-500 mt-1">Track your orders, invoices and submit new requests</p>
                </div>

                {/* Hero CTA — Submit RFQ */}
                <Link href="/customer/rfqs/create"
                    className="block group rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white p-5 sm:p-6 shadow-premium-lg hover:shadow-2xl transition-all hover:-translate-y-0.5">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
                            <i className="fi fi-rr-paper-plane text-xl sm:text-2xl leading-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold uppercase tracking-wider text-white/70">Need a new job done?</div>
                            <div className="text-base sm:text-lg font-bold mt-0.5">Submit a Request for Quotation</div>
                            <div className="text-xs sm:text-sm text-white/80 mt-1">Describe the job, attach drawings/samples, get a formal quotation from BITAC IED.</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl bg-white/15 backdrop-blur text-xs font-bold shrink-0 group-hover:bg-white/25 transition-colors">
                            Start <i className="fi fi-rr-arrow-right text-xs leading-none" />
                        </div>
                    </div>
                </Link>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {STAT_CARDS.map(s => (
                        <Link key={s.key} href={s.href} className="block animate-slide-up">
                            <div className="stat-card transition-all duration-200 hover:shadow-premium-lg hover:-translate-y-0.5">
                                <div className={`stat-icon shadow-lg bg-gradient-to-br ${s.gradient} text-white`}>
                                    <i className={`fi ${s.icon} leading-none`} />
                                </div>
                                <div className="min-w-0">
                                    <div className="stat-value tabular-nums">{stats?.[s.key] ?? 0}</div>
                                    <p className="stat-label">{s.label}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Two column */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Orders */}
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md">
                                    <i className="fi fi-rr-clipboard-list leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-surface-800">Recent Orders</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Latest work orders</p>
                                </div>
                            </div>
                            <Link href="/customer/work-orders" className="btn-outline btn-xs">
                                View all <i className="fi fi-rr-arrow-right leading-none text-[10px]" />
                            </Link>
                        </div>
                        <div className="card-body">
                            {(!recentOrders || recentOrders.length === 0) ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                    <p className="empty-state-title">No orders yet</p>
                                    <p className="empty-state-text">Your work orders will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentOrders.map((wo: any) => {
                                        const pct = wo.progress_pct ?? 0;
                                        const barColor =
                                            wo.status === 'cancelled'  ? 'bg-surface-300' :
                                            pct >= 100                  ? 'bg-emerald-500' :
                                            pct >= 70                   ? 'bg-blue-500' :
                                            pct >= 30                   ? 'bg-amber-500' :
                                                                          'bg-surface-300';
                                        return (
                                            <Link
                                                key={wo.id}
                                                href={`/customer/work-orders/${wo.id}`}
                                                className="block rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-white hover:shadow-sm p-3 transition-all"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-mono text-sm font-bold text-brand-600">{wo.wo_number}</p>
                                                        <p className="text-xs text-surface-500 truncate mt-0.5">{wo.product}</p>
                                                    </div>
                                                    <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'} shrink-0`}>
                                                        {wo.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                {wo.status !== 'cancelled' && (
                                                    <div className="mt-2.5 flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                                                            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.max(2, pct)}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-surface-600 tabular-nums w-9 text-right">{pct}%</span>
                                                    </div>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Invoices */}
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md">
                                    <i className="fi fi-rr-receipt leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-surface-800">Recent Invoices</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Latest billing activity</p>
                                </div>
                            </div>
                            <Link href="/customer/invoices" className="btn-outline btn-xs">
                                View all <i className="fi fi-rr-arrow-right leading-none text-[10px]" />
                            </Link>
                        </div>
                        <div className="card-body">
                            {(!recentInvoices || recentInvoices.length === 0) ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><i className="fi fi-rr-receipt" /></div>
                                    <p className="empty-state-title">No invoices yet</p>
                                    <p className="empty-state-text">Your invoices will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentInvoices.map((inv: any) => (
                                        <Link
                                            key={inv.id}
                                            href={`/customer/invoices/${inv.id}`}
                                            className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-white hover:shadow-sm p-3 transition-all"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-mono text-sm font-bold text-surface-800">{inv.invoice_number}</p>
                                                <p className="text-xs text-surface-500 mt-0.5">Due: {inv.due_date ?? 'N/A'}</p>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-sm font-semibold text-surface-900 tabular-nums">BDT {Number(inv.total_amount).toLocaleString('en-IN')}</p>
                                                <span className={`badge ${inv.status === 'paid' ? 'badge-green' : 'badge-amber'} mt-1`}>{inv.status}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="glass p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
                            <i className="fi fi-rr-bolt leading-none text-lg" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-surface-900">Quick Actions</h3>
                            <p className="text-xs text-surface-500 mt-0.5">Request a quote or submit feedback</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/customer/documents" className="btn-primary btn-sm">
                            <i className="fi fi-rr-folder-open leading-none text-xs" /> All Documents
                        </Link>
                        <Link href="/customer/complaints/create" className="btn-outline btn-sm">
                            <i className="fi fi-rr-comment-alt leading-none text-xs" /> Submit Feedback/Compliment
                        </Link>
                    </div>
                </div>
            </div>
        </CustomerLayout>
    );
}
