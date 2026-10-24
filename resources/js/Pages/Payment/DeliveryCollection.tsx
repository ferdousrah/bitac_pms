import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

/** Money in the UI face with tabular figures, as on Receivables. */
const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qty = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * Delivered vs Received — what has gone out to clients, what has come back.
 * Every figure comes from DeliveryCollectionController::build(), which the
 * printed sheet uses too.
 */
export default function DeliveryCollection({ rows = [], clients = [], totals, filters, customers = [] }: any) {
    const [view, setView] = useState<'clients' | 'jobs'>('clients');
    const [f, setF] = useState({
        from: filters.from ?? '', to: filters.to ?? '',
        customer_id: filters.customer_id ?? '', search: filters.search ?? '',
    });
    const [showPdf, setShowPdf] = useState(false);

    const query = (o: typeof f) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null));
    const apply = (patch: Partial<typeof f> = {}) => {
        const next = { ...f, ...patch };
        setF(next);
        router.get('/delivered-vs-received', query(next), { preserveState: true, preserveScroll: true, replace: true });
    };
    const clear = () => apply({ from: '', to: '', customer_id: '', search: '' });
    const hasFilter = !!(filters.from || filters.to || filters.customer_id || filters.search);
    const pdfQuery = new URLSearchParams(query({
        from: filters.from ?? '', to: filters.to ?? '', customer_id: filters.customer_id ?? '', search: filters.search ?? '',
    }) as any).toString();

    const delivered = Number(totals.delivered_value ?? 0);
    const paid = Number(totals.received ?? 0) + Number(totals.at_source ?? 0);
    const paidPct = delivered > 0 ? Math.min(100, (paid / delivered) * 100) : 0;
    const period = filters.from || filters.to
        ? `${filters.from ? new Date(filters.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'the start'} – ${filters.to ? new Date(filters.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'today'}`
        : 'All jobs to date';

    return (
        <AppLayout header="Delivered vs Received">
            <Head title="Delivered vs Received" />

            <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-surface-500">
                        The value of what has been <span className="font-semibold text-surface-700">delivered</span> against what the
                        client has <span className="font-semibold text-emerald-700">paid</span>, job by job.
                        <span className="text-surface-400"> · {period}</span>
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => setShowPdf(true)} className="btn-danger btn-sm">
                            <i className="fi fi-rr-file-pdf text-xs leading-none" /> Print / PDF
                        </button>
                        <Link href="/receivables" className="btn-outline btn-sm">
                            <i className="fi fi-rr-chart-pie text-xs leading-none" /> Receivables
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="card">
                    <div className="card-body flex flex-wrap items-end gap-3">
                        <div>
                            <label className="form-label !text-[11px]">From</label>
                            <input type="date" className="form-input !py-1.5 text-sm" value={f.from} onChange={(e) => apply({ from: e.target.value })} />
                        </div>
                        <div>
                            <label className="form-label !text-[11px]">To</label>
                            <input type="date" className="form-input !py-1.5 text-sm" value={f.to} onChange={(e) => apply({ to: e.target.value })} />
                        </div>
                        <div className="min-w-[14rem] flex-1 sm:flex-none">
                            <label className="form-label !text-[11px]">Client</label>
                            <select className="form-select !py-1.5 text-sm w-full" value={f.customer_id} onChange={(e) => apply({ customer_id: e.target.value })}>
                                <option value="">All clients</option>
                                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="relative flex-1 min-w-[12rem]">
                            <label className="form-label !text-[11px]">Search</label>
                            <i className="fi fi-rr-search absolute left-3 bottom-[0.7rem] text-[11px] leading-none text-surface-400" />
                            <input className="form-input !py-1.5 !pl-8 text-sm w-full" placeholder="Job no., WO no., client…  (Enter)"
                                value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && apply()} />
                        </div>
                        {hasFilter && (
                            <button type="button" onClick={clear} className="btn-ghost btn-sm">
                                <i className="fi fi-rr-cross-small text-xs leading-none" /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Headline — the gap is what this page is for. */}
                <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        <div className="lg:col-span-4 p-5 bg-gradient-to-br from-surface-50 via-white to-white lg:border-r border-surface-100">
                            <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Gap — delivered, not yet paid</p>
                            <p className={`text-3xl font-bold tabular-nums mt-1 leading-none ${totals.gap < 0 ? 'text-sky-700' : 'text-surface-900'}`}>
                                {money(totals.gap)}
                            </p>
                            <p className="text-xs text-surface-500 mt-2">
                                of <span className="font-semibold text-surface-700 tabular-nums">{money(delivered)}</span> delivered
                            </p>
                            <div className="mt-3">
                                <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                                </div>
                                <p className="text-[11px] text-surface-400 mt-1.5">
                                    {paidPct.toFixed(paidPct > 0 && paidPct < 1 ? 1 : 0)}% of the delivered value paid
                                    {totals.gap < 0 && ' · more received than delivered (advance)'}
                                </p>
                            </div>
                        </div>
                        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-px bg-surface-100 border-t lg:border-t-0 border-surface-100">
                            {[
                                { label: 'Delivered value', value: delivered, tone: 'text-surface-800', hint: `${totals.jobs} job${totals.jobs !== 1 ? 's' : ''}` },
                                { label: 'Billed', value: totals.billed, tone: 'text-surface-800', hint: 'bills raised' },
                                { label: 'Received', value: totals.received, tone: 'text-emerald-600', hint: 'cash in, incl. advances' },
                                { label: 'Deducted at source', value: totals.at_source, tone: totals.at_source > 0 ? 'text-teal-600' : 'text-surface-300', hint: 'tax / VAT — counts as paid' },
                                { label: 'Security held', value: totals.security_held, tone: totals.security_held > 0 ? 'text-amber-600' : 'text-surface-300', hint: 'part of the gap' },
                                { label: 'Not yet billed', value: totals.not_billed, tone: totals.not_billed > 0 ? 'text-rose-600' : 'text-surface-300', hint: 'delivered, no bill' },
                            ].map((c) => (
                                <div key={c.label} className="bg-white p-4">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{c.label}</p>
                                    <p className={`text-lg font-bold tabular-nums mt-1 leading-tight ${c.tone}`}>{money(c.value)}</p>
                                    <p className="text-[10px] text-surface-400 mt-0.5">{c.hint}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="card">
                    <div className="card-header flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5">
                            {([['clients', `By client (${clients.length})`], ['jobs', `By job (${rows.length})`]] as const).map(([k, l]) => (
                                <button key={k} type="button" onClick={() => setView(k)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === k ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <span className="text-[11px] text-surface-400">Largest gap first</span>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {rows.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-12 h-12 rounded-xl bg-surface-50 flex items-center justify-center mx-auto mb-3">
                                    <i className="fi fi-rr-truck-side text-surface-400 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">Nothing to show</p>
                                <p className="text-xs text-surface-400 mt-1">
                                    {hasFilter ? 'Nothing was delivered, billed or received for these filters.' : 'No job has been delivered, billed or paid for yet.'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-surface-200 text-[10px] uppercase tracking-wider text-surface-400 font-bold">
                                        <th className="text-left px-4 py-2.5">{view === 'clients' ? 'Client' : 'Job'}</th>
                                        {view === 'jobs' && <th className="text-center px-3 py-2.5 w-24">Delivered<br />qty</th>}
                                        <th className="text-right px-3 py-2.5 w-28">Delivered<br />value</th>
                                        <th className="text-right px-3 py-2.5 w-28">Billed</th>
                                        <th className="text-right px-3 py-2.5 w-28">Received</th>
                                        <th className="text-right px-3 py-2.5 w-24">At<br />source</th>
                                        <th className="text-right px-3 py-2.5 w-24">Security<br />held</th>
                                        <th className="text-right px-4 py-2.5 w-32">Gap</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(view === 'clients' ? clients : rows).map((r: any) => (
                                        <tr key={view === 'clients' ? `c${r.customer_id}` : `j${r.id}`} className="border-b border-surface-50 hover:bg-brand-50/30 transition-colors">
                                            <td className="px-4 py-3 max-w-[22rem]">
                                                {view === 'clients' ? (
                                                    <>
                                                        <button type="button" onClick={() => { apply({ customer_id: String(r.customer_id) }); setView('jobs'); }}
                                                            className="font-semibold text-surface-900 hover:text-brand-600 transition-colors text-left line-clamp-2">
                                                            {r.customer}
                                                        </button>
                                                        <div className="text-[11px] text-surface-400 mt-0.5">{r.jobs} job{r.jobs !== 1 ? 's' : ''}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link href={`/work-orders/${r.id}`} className="font-semibold text-surface-900 hover:text-brand-600 transition-colors">{r.job}</Link>
                                                        <div className="text-[11px] text-surface-500 truncate">{r.customer}</div>
                                                        {r.over_billed && (
                                                            <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">Billed more than delivered</span>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            {view === 'jobs' && (
                                                <td className="px-3 py-3 text-center tabular-nums text-surface-600">
                                                    {qty(r.delivered_qty)} <span className="text-surface-400">of {qty(r.ordered_qty)}</span>
                                                </td>
                                            )}
                                            <td className="px-3 py-3 text-right tabular-nums font-semibold text-surface-800">{money(r.delivered_value)}</td>
                                            <td className="px-3 py-3 text-right tabular-nums text-surface-500">
                                                {money(r.billed)}
                                                {r.not_billed > 0 && <div className="text-[10px] text-rose-600">{money(r.not_billed)} not billed</div>}
                                            </td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.received > 0 ? 'text-emerald-600' : 'text-surface-300'}`}>
                                                {r.received > 0 ? money(r.received) : '—'}
                                            </td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.at_source > 0 ? 'text-teal-700' : 'text-surface-300'}`}>
                                                {r.at_source > 0 ? money(r.at_source) : '—'}
                                            </td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.security_held > 0 ? 'text-amber-700 font-semibold' : 'text-surface-300'}`}>
                                                {r.security_held > 0 ? money(r.security_held) : '—'}
                                            </td>
                                            <td className={`px-4 py-3 text-right tabular-nums font-bold ${r.gap < 0 ? 'text-sky-700' : r.gap > 0 ? 'text-surface-900' : 'text-emerald-600'}`}>
                                                {Math.abs(r.gap) <= 0.01 ? 'Paid' : money(r.gap)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-surface-50 border-t-2 border-surface-200 font-bold text-surface-900">
                                        <td className="px-4 py-3">Total</td>
                                        {view === 'jobs' && <td />}
                                        <td className="px-3 py-3 text-right tabular-nums">{money(delivered)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{money(totals.billed)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money(totals.received)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-teal-700">{money(totals.at_source)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-amber-700">{money(totals.security_held)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.gap)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>

                <p className="text-[11px] text-surface-400 leading-relaxed px-1">
                    <span className="font-semibold text-surface-500">Delivered value</span> is each job's quotation total in proportion to the
                    quantity delivered. <span className="font-semibold text-surface-500">Received</span> is cash from the client — bill payments net
                    of deductions, security released and advances. <span className="font-semibold text-surface-500">At source</span> is income tax /
                    VAT the client deducted and deposited; it counts as paid. <span className="font-semibold text-surface-500">Gap</span> = delivered
                    value − received − at source, and includes any security the client still holds; a negative gap is an advance.
                    With dates set, each figure counts only its own events in the period — deliveries by delivery date, bills by issue date,
                    receipts by payment date.
                </p>
            </div>

            <PdfPopupModal
                open={showPdf}
                pdfUrl={showPdf ? `/delivered-vs-received/pdf?${pdfQuery}` : null}
                title="Delivered vs Received"
                subtitle={period}
                onClose={() => setShowPdf(false)}
            />
        </AppLayout>
    );
}
