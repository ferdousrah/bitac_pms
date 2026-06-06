import { Link } from '@inertiajs/react';
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

const formatBDT = (n: number) => {
    if (!n || n < 1) return '৳0';
    if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(1)} Cr`;
    if (n >= 100_000)    return `৳${(n / 100_000).toFixed(1)} L`;
    if (n >= 1_000)      return `৳${(n / 1_000).toFixed(0)}k`;
    return `৳${Math.round(n)}`;
};

const RFQ_STATUS_BADGE: Record<string, { label: string; class: string }> = {
    pending:  { label: 'Under Review', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    quoted:   { label: 'Quoted',       class: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'Accepted',     class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Cancelled',    class: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export default function CustomerDashboard({ customer, stats, lifetime, recentOrders, recentInvoices, recentRfqs }: any) {
    const greetName = customer?.contact_person?.split(' ')[0] ?? customer?.name ?? 'there';
    const hour = new Date().getHours();
    const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const hasAnyActivity = (lifetime?.total_projects ?? 0) > 0 || (lifetime?.rfqs_submitted ?? 0) > 0;

    return (
        <CustomerLayout>
            <div className="space-y-6 animate-fade-in">

                {/* ─────────── HEADER: Account banner with gear motif ─────────── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-7">
                    {/* Decorative gear SVG — industrial motif */}
                    <svg className="absolute -right-12 -bottom-12 w-56 h-56 opacity-[0.08] pointer-events-none"
                        viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                    </svg>
                    <svg className="absolute -left-6 -top-6 w-32 h-32 opacity-[0.05] pointer-events-none"
                        viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                    </svg>

                    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="flex items-start gap-4">
                            {/* Customer initial avatar */}
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg ring-2 ring-white/10 shrink-0">
                                <span className="font-bold text-xl">{(customer?.name ?? 'C').charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold mb-1">{timeGreet}</p>
                                <h1 className="text-xl sm:text-2xl font-bold leading-tight">{greetName}</h1>
                                <p className="text-sm text-white/70 mt-1 truncate">{customer?.name}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-white/60">
                                    {lifetime?.member_since && (
                                        <span className="inline-flex items-center gap-1">
                                            <i className="fi fi-rr-calendar text-[10px] leading-none" />
                                            BITAC client since {lifetime.member_since}
                                        </span>
                                    )}
                                    {customer?.email && (
                                        <span className="inline-flex items-center gap-1 truncate">
                                            <i className="fi fi-rr-envelope text-[10px] leading-none" /> {customer.email}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Lifetime mini-stats — only shown for established customers */}
                        {hasAnyActivity && (
                            <div className="flex items-center gap-6 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur shrink-0">
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Projects</div>
                                    <div className="text-xl font-bold mt-0.5">{lifetime.total_projects}</div>
                                </div>
                                <div className="w-px h-8 bg-white/15"></div>
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Lifetime Value</div>
                                    <div className="text-xl font-bold mt-0.5">{formatBDT(lifetime.total_billed)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─────────── HERO CTA ─────────── */}
                <Link href="/customer/rfqs/create"
                    className="block group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white p-5 sm:p-6 shadow-premium-lg hover:shadow-2xl transition-all hover:-translate-y-0.5">
                    {/* Subtle blueprint grid pattern */}
                    <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
                        style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                    <div className="relative flex items-center gap-4 sm:gap-5">
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

                {/* ─────────── STATS STRIP — operational pulse ─────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <StatCard label="Active Orders"      value={stats.active_orders}      sublabel="in workflow"           icon="fi-rr-clipboard-list" tone="blue"    href="/customer/work-orders" />
                    <StatCard label="In Production"      value={stats.in_production}      sublabel="on shop floor now"     icon="fi-rr-settings"       tone="amber"   href="/customer/work-orders?status=in_production" />
                    <StatCard label="Ready for Delivery" value={stats.ready_for_delivery} sublabel="awaiting dispatch"     icon="fi-rr-truck-side"     tone="emerald" href="/customer/work-orders?status=ready_for_delivery" />
                    <StatCard label="Outstanding Dues"   value={formatBDT(lifetime?.outstanding_due ?? 0)} sublabel={`${stats.unpaid_invoices} unpaid invoice${stats.unpaid_invoices !== 1 ? 's' : ''}`} icon="fi-rr-receipt" tone="rose" href="/customer/invoices" isText />
                </div>

                {/* ─────────── MAIN GRID — Activity (2/3) + Side (1/3) ─────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                    {/* LEFT: Recent Orders */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">

                        <div className="card overflow-hidden">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Recent Orders</h3>
                                    <p className="text-[11px] text-surface-400 mt-0.5">Latest work orders BITAC is producing for you</p>
                                </div>
                                {recentOrders.length > 0 && (
                                    <Link href="/customer/work-orders" className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                                        All orders <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                    </Link>
                                )}
                            </div>
                            <div className="card-body p-0">
                                {recentOrders.length === 0 ? (
                                    <EmptyState
                                        icon="fi-rr-clipboard-list-check"
                                        title="No active orders yet"
                                        body="Once BITAC converts your accepted quotation into a work order, production status will appear here in real time."
                                        actionHref="/customer/rfqs/create"
                                        actionLabel="Start with an RFQ"
                                    />
                                ) : (
                                    <ul className="divide-y divide-surface-100">
                                        {recentOrders.map((wo: any) => (
                                            <li key={wo.id}>
                                                <Link href={`/customer/work-orders/${wo.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/70 transition-colors">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                                        <i className="fi fi-rr-cube text-sm leading-none" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-bold text-surface-900">{wo.wo_number}</span>
                                                            <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'} !text-[9px]`}>{wo.status_label}</span>
                                                        </div>
                                                        <div className="text-xs text-surface-600 mt-0.5 truncate">{wo.product}</div>
                                                        {wo.progress_pct > 0 && (
                                                            <div className="mt-1.5 flex items-center gap-2">
                                                                <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all"
                                                                         style={{ width: `${wo.progress_pct}%` }} />
                                                                </div>
                                                                <span className="text-[10px] font-mono font-semibold text-surface-500 shrink-0">{wo.progress_pct}%</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="font-mono font-semibold text-sm text-surface-900">{Number(wo.quantity).toLocaleString('en-IN')}</div>
                                                        <div className="text-[10px] text-surface-400">qty</div>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Recent Invoices */}
                        <div className="card overflow-hidden">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Recent Invoices</h3>
                                    <p className="text-[11px] text-surface-400 mt-0.5">Billing activity from BITAC accounts</p>
                                </div>
                                {recentInvoices.length > 0 && (
                                    <Link href="/customer/invoices" className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                                        All invoices <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                    </Link>
                                )}
                            </div>
                            <div className="card-body p-0">
                                {recentInvoices.length === 0 ? (
                                    <div className="px-5 py-6 text-center">
                                        <div className="inline-flex w-10 h-10 rounded-xl bg-surface-100 text-surface-400 items-center justify-center mb-2">
                                            <i className="fi fi-rr-receipt text-sm leading-none" />
                                        </div>
                                        <p className="text-xs text-surface-500">No invoices yet. Invoices are auto-generated once an order is delivered.</p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-surface-100">
                                        {recentInvoices.map((inv: any) => (
                                            <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                                    ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    <i className={`fi ${inv.status === 'paid' ? 'fi-rr-check' : 'fi-rr-receipt'} text-sm leading-none`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-mono text-xs font-bold text-surface-900">{inv.invoice_number}</div>
                                                    <div className="text-[10px] text-surface-400 mt-0.5">
                                                        {inv.status === 'paid' ? 'Paid' : `Due ${inv.due_date ?? '—'}`}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-mono font-bold text-sm text-surface-900">৳{Number(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: RFQs + How-it-works for new customers */}
                    <div className="space-y-4 sm:space-y-6">

                        {/* My RFQs panel */}
                        <div className="card overflow-hidden">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">My RFQs</h3>
                                    <p className="text-[11px] text-surface-400 mt-0.5">{lifetime?.rfqs_pending ?? 0} pending review</p>
                                </div>
                                {recentRfqs?.length > 0 && (
                                    <Link href="/customer/rfqs" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                        View all
                                    </Link>
                                )}
                            </div>
                            <div className="card-body p-0">
                                {!recentRfqs || recentRfqs.length === 0 ? (
                                    <div className="px-5 py-6 text-center">
                                        <div className="inline-flex w-10 h-10 rounded-xl bg-surface-100 text-surface-400 items-center justify-center mb-2">
                                            <i className="fi fi-rr-file-invoice text-sm leading-none" />
                                        </div>
                                        <p className="text-xs text-surface-500">No RFQs submitted yet.</p>
                                        <Link href="/customer/rfqs/create" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700">
                                            Submit your first RFQ <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                        </Link>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-surface-100">
                                        {recentRfqs.map((r: any) => {
                                            const badge = RFQ_STATUS_BADGE[r.status] ?? { label: r.status, class: 'bg-slate-50 text-slate-600 border-slate-200' };
                                            return (
                                                <li key={r.id}>
                                                    <Link href={`/customer/rfqs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50/70 transition-colors">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-xs font-bold text-brand-600">#{r.id}</span>
                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badge.class}`}>
                                                                    {badge.label}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-surface-400 mt-0.5">
                                                                {r.item_count} item{r.item_count !== 1 ? 's' : ''} · {r.created_at}
                                                            </div>
                                                        </div>
                                                        <i className="fi fi-rr-arrow-right text-[10px] leading-none text-surface-300" />
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* How BITAC works — onboarding strip, especially valuable for new customers */}
                        {!hasAnyActivity && (
                            <div className="card overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
                                <div className="card-header bg-transparent">
                                    <h3 className="text-sm font-bold text-amber-900">How BITAC works</h3>
                                    <p className="text-[11px] text-amber-700/80 mt-0.5">5 simple steps from request to delivery</p>
                                </div>
                                <div className="card-body space-y-2.5">
                                    {[
                                        { n: 1, t: 'Submit RFQ',        d: 'Describe what you need, attach drawings' },
                                        { n: 2, t: 'Receive quotation', d: 'IED team prepares & sends formal pricing' },
                                        { n: 3, t: 'Accept & convert',  d: 'Approved RFQ becomes a work order' },
                                        { n: 4, t: 'Production & QC',   d: 'Track shop-floor progress in real time' },
                                        { n: 5, t: 'Delivery & invoice', d: 'Goods dispatched, invoice issued' },
                                    ].map(s => (
                                        <div key={s.n} className="flex items-start gap-3">
                                            <div className="w-6 h-6 rounded-full bg-white text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm ring-1 ring-amber-200">
                                                {s.n}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-amber-900">{s.t}</div>
                                                <div className="text-[11px] text-amber-700/80 leading-snug">{s.d}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick contact */}
                        <div className="card overflow-hidden">
                            <div className="card-body">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center shrink-0">
                                        <i className="fi fi-rr-headset text-sm leading-none" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-surface-900">Need help?</div>
                                        <p className="text-[11px] text-surface-500 mt-0.5">BITAC IED team is here to assist with your order or quotation.</p>
                                        <Link href="/customer/complaints/create"
                                            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                                            Send a message <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </CustomerLayout>
    );
}

/* ────────── Stat card ────────── */
const TONE_BG: Record<string, string> = {
    blue:    'from-blue-50 to-blue-100 text-blue-600',
    amber:   'from-amber-50 to-amber-100 text-amber-600',
    emerald: 'from-emerald-50 to-emerald-100 text-emerald-600',
    rose:    'from-rose-50 to-rose-100 text-rose-600',
};

function StatCard({ label, value, sublabel, icon, tone, href, isText }: any) {
    return (
        <Link href={href} className="block group">
            <div className="bg-white rounded-2xl border border-surface-100 p-3.5 sm:p-4 hover:border-brand-200 hover:shadow-premium transition-all">
                <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} flex items-center justify-center shrink-0`}>
                        <i className={`fi ${icon} text-sm leading-none`} />
                    </div>
                    <i className="fi fi-rr-arrow-up-right opacity-0 group-hover:opacity-100 text-[10px] text-surface-300 transition-opacity leading-none mt-1" />
                </div>
                <div className={`mt-3 ${isText ? 'font-bold text-base' : 'font-bold text-2xl'} text-surface-900 leading-tight font-mono`}>
                    {value ?? 0}
                </div>
                <div className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
                <div className="text-[10px] text-surface-400 mt-0.5">{sublabel}</div>
            </div>
        </Link>
    );
}

/* ────────── Premium empty state ────────── */
function EmptyState({ icon, title, body, actionHref, actionLabel }: any) {
    return (
        <div className="px-6 py-10 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-50 to-surface-100 items-center justify-center mb-3 ring-1 ring-surface-200/50">
                <i className={`fi ${icon} text-xl text-surface-400 leading-none`} />
            </div>
            <p className="text-sm font-bold text-surface-700">{title}</p>
            <p className="text-xs text-surface-500 mt-1 max-w-sm mx-auto leading-relaxed">{body}</p>
            {actionHref && (
                <Link href={actionHref} className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition-colors">
                    {actionLabel} <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                </Link>
            )}
        </div>
    );
}
