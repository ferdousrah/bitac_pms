import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

/**
 * ⚠️ Money is set in the UI face with `tabular-nums`, never `font-mono`.
 * The figures used to be monospaced, which made every column read like a
 * typewriter and set the ৳ at a width it was never drawn for. Tabular figures
 * line the digits up down a column, which is the only thing mono was for.
 */
const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One colour per ageing bucket, oldest = hottest. Written out in full —
 *  Tailwind only ships classes it can see in the source. */
const bucketFill: Record<string, string> = {
    current: 'bg-slate-300',
    '0_30': 'bg-sky-400',
    '31_60': 'bg-amber-400',
    '61_90': 'bg-orange-500',
    '90_plus': 'bg-rose-500',
};
const bucketText: Record<string, string> = {
    current: 'text-slate-500',
    '0_30': 'text-sky-600',
    '31_60': 'text-amber-600',
    '61_90': 'text-orange-600',
    '90_plus': 'text-rose-600',
};

const BUCKETS = ['current', '0_30', '31_60', '61_90', '90_plus'];

/** The proportions of one row's (or the whole report's) ageing, as one bar. */
function AgeingBar({ ageing, total, className = 'h-3' }: { ageing: any; total: number; className?: string }) {
    if (!total || total <= 0) {
        return <div className={`${className} rounded-full bg-surface-100`} />;
    }
    return (
        <div className={`${className} rounded-full bg-surface-100 overflow-hidden flex`}>
            {BUCKETS.map((b) => {
                const value = Number(ageing?.[b] ?? 0);
                if (value <= 0) return null;
                return (
                    <div key={b} className={bucketFill[b]}
                        style={{ width: `${(value / total) * 100}%` }}
                        title={`${b}: ${money(value)}`} />
                );
            })}
        </div>
    );
}

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

    const billed = Number(totals.billed ?? 0);
    const settled = Number(totals.settled ?? 0);
    const due = Number(totals.due ?? 0);
    const collectedPct = billed > 0 ? Math.min(100, (settled / billed) * 100) : 0;
    const agedTotal = BUCKETS.reduce((sum, b) => sum + Number(ageing?.[b] ?? 0), 0);

    return (
        <AppLayout header="Receivables">
            <Head title="Receivables" />

            <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">

                {/* Header strip — a line of explanation, not a slab of it. */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-surface-500">
                        What each client still owes, how much of it is{' '}
                        <span className="font-semibold text-amber-700">security not yet returned</span>, and any{' '}
                        <span className="font-semibold text-sky-700">advance already in hand</span>.
                        <span className="text-surface-400"> · Ageing runs from {creditDays} days after a bill was issued.</span>
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

                {/* ── The headline. Due is the number this page exists for, so it
                       is the only one set large; the rest support it. ───────── */}
                <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        <div className="lg:col-span-4 p-5 bg-gradient-to-br from-surface-50 via-white to-white lg:border-r border-surface-100">
                            <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Total due</p>
                            <p className="text-3xl font-bold text-surface-900 tabular-nums mt-1 leading-none">
                                {money(due)}
                            </p>
                            <p className="text-xs text-surface-500 mt-2">
                                of <span className="font-semibold text-surface-700 tabular-nums">{money(billed)}</span> billed
                            </p>

                            <div className="mt-3">
                                <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${collectedPct}%` }} />
                                </div>
                                <p className="text-[11px] text-surface-400 mt-1.5">
                                    {collectedPct.toFixed(collectedPct > 0 && collectedPct < 1 ? 1 : 0)}% collected
                                    {totals.advance_available > 0 && (
                                        <> · net receivable{' '}
                                            <span className="font-semibold text-surface-600 tabular-nums">
                                                {money(totals.net_receivable)}
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* ⚠️ Separators come from a 1px gap over a tinted background, not
                                from divide-x/divide-y. In a CSS grid `divide-y` puts a top
                                border on every child after the first, so cells 2 and 3 of the
                                FIRST row get a stray rule above them. */}
                        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-px bg-surface-100 border-t lg:border-t-0 border-surface-100">
                            {[
                                { label: 'Billed', value: billed, tone: 'text-surface-800', hint: `${rows.length} client${rows.length !== 1 ? 's' : ''}` },
                                { label: 'Settled', value: settled, tone: 'text-emerald-600', hint: 'cash + tax at source' },
                                { label: 'Overdue', value: totals.overdue, tone: totals.overdue > 0 ? 'text-rose-600' : 'text-surface-300', hint: `past ${creditDays} days` },
                                { label: 'Security held', value: totals.security_held, tone: totals.security_held > 0 ? 'text-amber-600' : 'text-surface-300', hint: 'part of the due' },
                                { label: 'Advance in hand', value: totals.advance_available, tone: totals.advance_available > 0 ? 'text-sky-600' : 'text-surface-300', hint: "client's money" },
                                { label: 'Net receivable', value: totals.net_receivable, tone: 'text-surface-900', hint: 'due − advance' },
                            ].map((cell) => (
                                <div key={cell.label} className="bg-white p-4">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{cell.label}</p>
                                    <p className={`text-lg font-bold tabular-nums mt-1 leading-tight ${cell.tone}`}>
                                        {money(cell.value)}
                                    </p>
                                    <p className="text-[10px] text-surface-400 mt-0.5">{cell.hint}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Ageing: one bar beats five boxes that are mostly zero. ── */}
                <div className="card">
                    <div className="card-header flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-surface-900">Ageing of the dues</h3>
                        <span className="text-[11px] text-surface-400">
                            counted from {creditDays} days after a bill was issued
                        </span>
                    </div>
                    <div className="card-body">
                        {agedTotal <= 0 ? (
                            <div className="flex items-center gap-3 py-2">
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-badge-check text-sm leading-none" />
                                </div>
                                <p className="text-sm text-surface-500">Nothing is ageing — no bill is outstanding.</p>
                            </div>
                        ) : (
                            <>
                                <AgeingBar ageing={ageing} total={agedTotal} />
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3">
                                    {BUCKETS.map((b) => {
                                        const value = Number(ageing?.[b] ?? 0);
                                        const pct = agedTotal > 0 ? (value / agedTotal) * 100 : 0;
                                        return (
                                            <div key={b} className="flex items-start gap-2">
                                                <span className={`mt-1 w-2.5 h-2.5 rounded-sm shrink-0 ${value > 0 ? bucketFill[b] : 'bg-surface-200'}`} />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400 truncate">
                                                        {bucketLabels[b]}
                                                    </p>
                                                    <p className={`text-sm font-bold tabular-nums ${value > 0 ? bucketText[b] : 'text-surface-300'}`}>
                                                        {money(value)}
                                                    </p>
                                                    {value > 0 && (
                                                        <p className="text-[10px] text-surface-400">{pct.toFixed(0)}% of the dues</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── By client ──────────────────────────────────────────────── */}
                <div className="card">
                    <div className="card-header flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-surface-900">
                            By client <span className="text-surface-400 font-normal">({rows.length})</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                                <input className="form-input !py-1.5 !pl-8 text-sm w-56" placeholder="Search client…"
                                    value={search} onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && go({ search })} />
                            </div>
                            <label className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${filters.only_due
                                ? 'bg-brand-50 border-brand-200 text-brand-700'
                                : 'bg-white border-surface-200 text-surface-500 hover:bg-surface-50'}`}>
                                <input type="checkbox" className="accent-current" checked={!!filters.only_due}
                                    onChange={(e) => go({ only_due: e.target.checked ? 1 : 0 })} />
                                Outstanding only
                            </label>
                        </div>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {rows.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                                    <i className="fi fi-rr-badge-check text-emerald-500 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">Nothing outstanding</p>
                                <p className="text-xs text-surface-400 mt-1">
                                    {filters.search ? 'No client matches that search.' : 'Every bill is settled.'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-surface-200 text-[10px] uppercase tracking-wider text-surface-400 font-bold">
                                        <th className="text-left px-4 py-2.5">Client</th>
                                        <th className="text-right px-3 py-2.5 w-28">Billed</th>
                                        <th className="text-right px-3 py-2.5 w-28">Settled</th>
                                        <th className="text-right px-3 py-2.5 w-28">Due</th>
                                        <th className="text-right px-3 py-2.5 w-28">Overdue</th>
                                        <th className="text-right px-3 py-2.5 w-28">Security<br />held</th>
                                        <th className="text-right px-3 py-2.5 w-28">Advance</th>
                                        <th className="text-right px-4 py-2.5 w-32">Net<br />receivable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r: any) => (
                                        <tr key={r.customer_id} className="border-b border-surface-50 hover:bg-brand-50/30 transition-colors">
                                            <td className="px-4 py-3 max-w-[22rem]">
                                                <Link href={`/receivables/${r.customer_id}`}
                                                    className="font-semibold text-surface-900 hover:text-brand-600 transition-colors line-clamp-2">
                                                    {r.customer}
                                                </Link>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[11px] text-surface-400 shrink-0">
                                                        {r.invoice_count} bill{r.invoice_count !== 1 ? 's' : ''}
                                                    </span>
                                                    {r.due > 0 && (
                                                        <AgeingBar ageing={r.ageing} total={r.due} className="h-1.5 w-24" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums text-surface-500">{money(r.billed)}</td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.settled > 0 ? 'text-emerald-600' : 'text-surface-300'}`}>
                                                {r.settled > 0 ? money(r.settled) : '—'}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums font-bold text-surface-900">{money(r.due)}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">
                                                {r.overdue > 0
                                                    ? <span className="inline-block px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold">{money(r.overdue)}</span>
                                                    : <span className="text-surface-300">—</span>}
                                            </td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.security_held > 0 ? 'text-amber-700 font-semibold' : 'text-surface-300'}`}>
                                                {r.security_held > 0 ? money(r.security_held) : '—'}
                                            </td>
                                            <td className={`px-3 py-3 text-right tabular-nums ${r.advance_available > 0 ? 'text-sky-700 font-semibold' : 'text-surface-300'}`}>
                                                {r.advance_available > 0 ? money(r.advance_available) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums font-bold text-surface-900">
                                                {money(r.net_receivable)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-surface-50 border-t-2 border-surface-200 font-bold text-surface-900">
                                        <td className="px-4 py-3">Total</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{money(billed)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money(settled)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{money(due)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-rose-600">{money(totals.overdue)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-amber-700">{money(totals.security_held)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-sky-700">{money(totals.advance_available)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{money(totals.net_receivable)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>

                {/* ⚠️ These are not three separate debts — say so, here as on the
                    printed sheet, or the columns read as if they add up. */}
                <p className="text-[11px] text-surface-400 leading-relaxed px-1">
                    <span className="font-semibold text-surface-500">Security held</span> is money a client withheld from a
                    payment and has not returned — it is part of the Due, not additional to it.
                    <span className="font-semibold text-surface-500"> Advance in hand</span> is the client's money, already
                    received against a job that no bill has drawn on yet, so
                    <span className="font-semibold text-surface-500"> Net receivable</span> is the Due less that advance.
                    Income tax and VAT deducted at source are not dues — they reach the treasury against a challan and settle the bill.
                </p>
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
