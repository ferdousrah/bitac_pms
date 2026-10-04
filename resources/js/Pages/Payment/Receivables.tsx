import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const bucketTone: Record<string, string> = {
    current: 'bg-surface-100 text-surface-600',
    '0_30': 'bg-sky-50 text-sky-700',
    '31_60': 'bg-amber-50 text-amber-700',
    '61_90': 'bg-orange-50 text-orange-700',
    '90_plus': 'bg-rose-50 text-rose-700',
};

/**
 * Who owes BITAC what.
 *
 * ⚠️ Four different numbers, and they are not interchangeable:
 *   Due            unsettled on their bills
 *   Security held  BITAC's money they are holding — part of the Due
 *   Advance        their money BITAC holds, no bill has drawn on it
 *   Net            Due − Advance: what collection actually means
 *
 * Not year-scoped on purpose: what is outstanding is outstanding, whenever it
 * was billed. The ageing buckets are the time dimension here.
 */
export default function Receivables({ rows = [], filters, totals, ageing, bucketLabels, creditDays }: any) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [showPdf, setShowPdf] = useState(false);

    // The print carries the SAME filters, so what is on screen is what comes
    // out of the printer.
    const pdfQuery = new URLSearchParams({
        ...(filters.search ? { search: filters.search } : {}),
        only_due: filters.only_due ? '1' : '0',
    }).toString();

    const go = (patch: Record<string, any>) => {
        router.get('/receivables', {
            search, only_due: filters.only_due ? 1 : 0, ...patch,
        }, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout header="Receivables">
            <Head title="Receivables" />

            <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4 flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm text-surface-600 max-w-2xl">
                        What each client still owes, how much of it is <strong>security BITAC has not got back</strong>,
                        and any <strong>advance already in hand</strong>. Ageing runs from {creditDays} days
                        after a bill was issued.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => setShowPdf(true)} className="btn-danger btn-sm">
                            <i className="fi fi-rr-file-pdf text-xs leading-none" /> Print / PDF
                        </button>
                        <Link href="/payments" className="btn-outline btn-sm">
                            <i className="fi fi-rr-receipt text-xs leading-none" /> All payments
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                        ['Billed', money(totals.billed), 'text-surface-900'],
                        ['Settled', money(totals.settled), 'text-emerald-600'],
                        ['Due', money(totals.due), 'text-surface-900'],
                        ['Overdue', money(totals.overdue), totals.overdue > 0 ? 'text-rose-600' : 'text-surface-400'],
                        ['Security held', money(totals.security_held), totals.security_held > 0 ? 'text-amber-600' : 'text-surface-400'],
                    ].map(([label, value, tone]) => (
                        <div key={label} className="card"><div className="card-body">
                            <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">{label}</p>
                            <p className={`text-lg font-bold mt-1 font-mono ${tone}`}>{value}</p>
                        </div></div>
                    ))}
                </div>

                {/* Ageing across every client. */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <h3 className="text-sm font-bold text-surface-900">Ageing of the dues</h3>
                        <span className="text-[11px] text-surface-400">
                            advance in hand {money(totals.advance_available)} · net receivable {money(totals.net_receivable)}
                        </span>
                    </div>
                    <div className="card-body grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {Object.entries(bucketLabels).map(([key, label]) => (
                            <div key={key} className={`rounded-xl p-3 ${bucketTone[key] ?? 'bg-surface-100'}`}>
                                <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label as string}</p>
                                <p className="text-base font-bold font-mono mt-1">{money(ageing[key] ?? 0)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-surface-900">
                            By client <span className="text-surface-400 font-normal">({rows.length})</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <input className="form-input !py-1.5 text-sm w-56" placeholder="Search client…"
                                value={search} onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && go({ search })} />
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-600">
                                <input type="checkbox" checked={!!filters.only_due}
                                    onChange={(e) => go({ only_due: e.target.checked ? 1 : 0 })} />
                                Only with money outstanding
                            </label>
                        </div>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {rows.length === 0 ? (
                            <div className="text-center py-14">
                                <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                    <i className="fi fi-rr-badge-check text-surface-400 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">Nothing outstanding</p>
                                <p className="text-xs text-surface-400 mt-1">Every bill is settled.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2">Client</th>
                                        <th className="text-right px-3 py-2 w-28">Billed</th>
                                        <th className="text-right px-3 py-2 w-28">Settled</th>
                                        <th className="text-right px-3 py-2 w-28">Due</th>
                                        <th className="text-right px-3 py-2 w-28">Overdue</th>
                                        <th className="text-right px-3 py-2 w-28">Security held</th>
                                        <th className="text-right px-3 py-2 w-28">Advance</th>
                                        <th className="text-right px-4 py-2 w-32">Net receivable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r: any) => (
                                        <tr key={r.customer_id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5">
                                                <Link href={`/receivables/${r.customer_id}`}
                                                    className="font-semibold text-brand-600 hover:underline">
                                                    {r.customer}
                                                </Link>
                                                <p className="text-[11px] text-surface-400">
                                                    {r.invoice_count} bill{r.invoice_count !== 1 ? 's' : ''}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-surface-600">{money(r.billed)}</td>
                                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">{money(r.settled)}</td>
                                            <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-surface-900">{money(r.due)}</td>
                                            <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.overdue > 0 ? 'text-rose-600 font-bold' : 'text-surface-300'}`}>
                                                {r.overdue > 0 ? money(r.overdue) : '—'}
                                            </td>
                                            <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.security_held > 0 ? 'text-amber-700' : 'text-surface-300'}`}>
                                                {r.security_held > 0 ? money(r.security_held) : '—'}
                                            </td>
                                            <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.advance_available > 0 ? 'text-sky-700' : 'text-surface-300'}`}>
                                                {r.advance_available > 0 ? money(r.advance_available) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-surface-900">
                                                {money(r.net_receivable)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-surface-200 text-sm font-bold">
                                        <td className="px-4 py-2.5 text-surface-900">Total</td>
                                        <td className="px-3 py-2.5 text-right font-mono">{money(totals.billed)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{money(totals.settled)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono">{money(totals.due)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-rose-600">{money(totals.overdue)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-amber-700">{money(totals.security_held)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-sky-700">{money(totals.advance_available)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono">{money(totals.net_receivable)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <PdfPopupModal
                open={showPdf}
                pdfUrl={showPdf ? `/receivables/pdf?${pdfQuery}` : null}
                title="Statement of Receivables"
                subtitle={`As on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                onClose={() => setShowPdf(false)}
            />
        </AppLayout>
    );
}
