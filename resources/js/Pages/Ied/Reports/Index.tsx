import AppLayout from '@/Layouts/AppLayout';
import ReportPdfButton from '@/Components/Reports/ReportPdfButton';
import TargetAchievementPanel from '@/Components/Reports/TargetAchievementPanel';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const taka = (n: number) =>
    '৳ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const VIEWS = [
    // BITAC's names (2026-10-20). The keys stay, so old links still open the right tab.
    { key: 'clients',    label: 'Stakeholder' },
    { key: 'sector',     label: 'Sector Wise Job' },
    { key: 'quotations', label: 'Quotation Value' },
    { key: 'pipeline',   label: 'Jobs in Pipeline' },
    // ⚠️ Target vs Achievement lives here rather than under the production
    // Reports group: BITAC set the yearly figure from IED, so the report and
    // the form that sets it belong on the same desk.
    { key: 'target',     label: 'Target vs Achievement' },
] as const;

/** Where a waiting quotation stands. Written out in full — Tailwind only
 *  ships classes it can see in the source. */
const STATE_TONE: Record<string, string> = {
    sent_to_customer:   'bg-sky-50 text-sky-700 border-sky-200',
    revision_requested: 'bg-amber-50 text-amber-700 border-amber-200',
    superseded:         'bg-violet-50 text-violet-700 border-violet-200',
    customer_accepted:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Older is redder: these are quotations to follow up. */
const AGE_TONE: Record<string, string> = {
    '0_30': 'text-surface-600', '31_60': 'text-amber-600', '61_90': 'text-orange-600', '90_up': 'text-rose-600 font-semibold',
};

const typeBadge = (t: string | null) =>
    t === 'government' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : t === 'private'  ? 'bg-violet-50 text-violet-700 border-violet-200'
    :                    'bg-surface-100 text-surface-500 border-surface-200';

export default function IedReports({
    view, year, yearLabel, years, centerId, centers = [], search = '',
    clients, sectors, quotations, pipeline, target,
}: any) {
    const [q, setQ] = useState(search);

    const go = (patch: Record<string, any>) =>
        router.get('/ied/reports', { view, year, center_id: centerId ?? '', search: q, ...patch },
            { preserveState: false });

    const runSearch = (e: FormEvent) => { e.preventDefault(); go({ search: q }); };

    return (
        <AppLayout header="IED Reports">
            <Head title="IED Reports" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                {/* Which report */}
                <div className="flex flex-wrap items-center gap-2">
                    {VIEWS.map((v) => (
                        <button key={v.key} type="button" onClick={() => go({ view: v.key })}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                view === v.key ? 'bg-brand-500 text-white shadow-sm'
                                               : 'bg-surface-100 text-surface-500 hover:text-surface-700'
                            }`}>
                            {v.label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="card">
                    <div className="card-body flex flex-wrap items-end gap-4">
                        {view !== 'pipeline' && (
                            <div>
                                <label className="form-label !mb-1">Financial Year</label>
                                <select value={year} onChange={(e) => go({ year: e.target.value })}
                                    className="form-input text-sm w-72">
                                    {years.map((y: any) => <option key={y.value} value={y.value}>{y.label}</option>)}
                                </select>
                            </div>
                        )}
                        {centers.length > 0 && (
                            <div>
                                <label className="form-label !mb-1">Centre</label>
                                <select value={centerId ?? ''} onChange={(e) => go({ center_id: e.target.value })}
                                    className="form-input text-sm w-52">
                                    <option value="">All centres</option>
                                    {centers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                        {view === 'clients' && (
                            <form onSubmit={runSearch}>
                                <label className="form-label !mb-1">Search</label>
                                <input value={q} onChange={(e) => setQ(e.target.value)}
                                    placeholder="Stakeholder name…" className="form-input text-sm w-56" />
                            </form>
                        )}
                        <div className="ml-auto flex items-center gap-3">
                            {view !== 'pipeline' && (
                                <p className="text-xs text-surface-400">{yearLabel}</p>
                            )}
                            {/* Prints the tab that is open, with the filters
                                that are set — the server reads the same query
                                string the page was loaded with. */}
                            <ReportPdfButton
                                url={`/ied/reports/pdf?${new URLSearchParams({
                                    view,
                                    year,
                                    ...(centerId ? { center_id: String(centerId) } : {}),
                                    ...(view === 'clients' && search ? { search } : {}),
                                }).toString()}`}
                                title={VIEWS.find((v) => v.key === view)?.label ?? 'Report'}
                                subtitle={view === 'pipeline' ? undefined : yearLabel}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Target vs Achievement ─────────────────────────────── */}
                {view === 'target' && target && (
                    <TargetAchievementPanel
                        year={year}
                        rows={target.rows}
                        totals={target.totals}
                        canSetFor={target.canSetFor}
                        isSuperAdmin={target.isSuperAdmin}
                    />
                )}

                {/* ── Stakeholders (was "Client List") ─────────────────── */}
                {view === 'clients' && clients && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Stakeholders ({clients.length})</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Jobs and value are for {year}; the classification is current.
                            </p>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2">Stakeholder</th>
                                        <th className="text-left px-3 py-2 w-28">Type</th>
                                        <th className="text-left px-3 py-2 w-32">Sector</th>
                                        <th className="text-right px-3 py-2 w-16">Jobs</th>
                                        <th className="text-right px-3 py-2 w-32">Value</th>
                                        <th className="text-left px-4 py-2 w-28">Last job</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-sm text-surface-400">No stakeholders found.</td></tr>
                                    ) : clients.map((c: any) => (
                                        <tr key={c.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5">
                                                <span className="font-semibold text-surface-900">{c.name}</span>
                                                {c.contact && <p className="text-xs text-surface-400">{c.contact}{c.phone ? ` · ${c.phone}` : ''}</p>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${typeBadge(c.customer_type)}`}>
                                                    {c.type_label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-surface-600">{c.sector}</td>
                                            <td className="px-3 py-2.5 text-right font-mono">{c.jobs}</td>
                                            <td className="px-3 py-2.5 text-right font-mono font-semibold">{taka(c.value)}</td>
                                            <td className="px-4 py-2.5 text-xs text-surface-500">{c.last_job ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Sector Wise Job ───────────────────────────────────── */}
                {view === 'sector' && sectors && (
                    sectors.length === 0 ? (
                        <div className="card"><div className="card-body text-center py-10 text-sm text-surface-400">
                            No jobs in {year}.
                        </div></div>
                    ) : sectors.map((t: any) => (
                        <div key={t.type} className="card">
                            <div className="card-header flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${typeBadge(t.type)}`}>
                                        {t.type_label}
                                    </span>
                                    <span className="text-xs text-surface-400">{t.jobs} job(s)</span>
                                </div>
                                <span className="font-mono font-bold text-surface-900">{taka(t.value)}</span>
                            </div>
                            <div className="card-body p-0">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {t.sectors.map((s: any, i: number) => (
                                            <tr key={i} className="border-b border-surface-50 last:border-0">
                                                <td className="px-4 py-2 text-surface-700">{s.sector}</td>
                                                <td className="px-3 py-2 w-1/2">
                                                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                                        <div className="h-full rounded-full bg-brand-500"
                                                            style={{ width: `${t.value > 0 ? (s.value / t.value) * 100 : 0}%` }} />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-surface-500 w-16">{s.jobs}</td>
                                                <td className="px-4 py-2 text-right tabular-nums font-semibold w-32">{taka(s.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}

                {/* ── Quotation value ───────────────────────────────────── */}
                {view === 'quotations' && quotations && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: `Quoted in ${year}`, value: taka(quotations.value), sub: `${quotations.count} quotation(s)` },
                                { label: 'Turned into work', value: taka(quotations.converted_value), sub: `${quotations.converted_count} converted` },
                                {
                                    label: 'Conversion',
                                    value: quotations.value > 0
                                        ? Math.round((quotations.converted_value / quotations.value) * 1000) / 10 + '%'
                                        : '—',
                                    sub: 'by value',
                                },
                            ].map((t) => (
                                <div key={t.label} className="card"><div className="card-body">
                                    <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">{t.label}</p>
                                    <p className="text-xl font-bold text-surface-900 mt-1">{t.value}</p>
                                    <p className="text-xs text-surface-400 mt-0.5">{t.sub}</p>
                                </div></div>
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Month by month</h3>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    Each job counts once, at its latest given price — after a re-quotation, at the
                                    re-quotation&rsquo;s price. Dated from when that version went to the customer; drafts are not counted.
                                </p>
                            </div>
                            <div className="card-body p-0">
                                {quotations.monthly.length === 0 ? (
                                    <p className="text-center py-10 text-sm text-surface-400">Nothing quoted in this year.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {quotations.monthly.map((m: any) => {
                                                const max = Math.max(...quotations.monthly.map((x: any) => x.value), 1);
                                                return (
                                                    <tr key={m.month} className="border-b border-surface-50 last:border-0">
                                                        <td className="px-4 py-2 text-surface-700 w-28">{m.label}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                                                <div className="h-full rounded-full bg-emerald-500"
                                                                    style={{ width: `${(m.value / max) * 100}%` }} />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono text-surface-500 w-16">{m.count}</td>
                                                        <td className="px-4 py-2 text-right font-mono font-semibold w-32">{taka(m.value)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Jobs in Pipeline: quoted, no order yet ─────────────── */}
                {view === 'pipeline' && pipeline && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="card"><div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Quoted, no order yet</p>
                                <p className="text-xl font-bold text-surface-900 mt-1">{pipeline.total.jobs}</p>
                                <p className="text-[11px] text-surface-400 mt-1">job{pipeline.total.jobs !== 1 ? 's' : ''} waiting for a work order</p>
                            </div></div>
                            <div className="card"><div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Quoted value</p>
                                <p className="text-xl font-bold text-surface-900 mt-1">{taka(pipeline.total.value)}</p>
                                <p className="text-[11px] text-surface-400 mt-1">at the price each client is holding</p>
                            </div></div>
                            <div className="card"><div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Longest waiting</p>
                                <p className="text-xl font-bold text-surface-900 mt-1">
                                    {pipeline.total.oldest_days !== null && pipeline.total.oldest_days !== undefined ? `${pipeline.total.oldest_days} days` : '—'}
                                </p>
                                <p className="text-[11px] text-surface-400 mt-1">since the quotation was given</p>
                            </div></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SummaryCard title="Where they stand" rows={pipeline.by_state}
                                dot={(k: string) => STATE_TONE[k] ?? 'bg-surface-100 text-surface-600 border-surface-200'} />
                            <SummaryCard title="How long they have been waiting" rows={pipeline.ageing}
                                text={(k: string) => AGE_TONE[k] ?? 'text-surface-600'} />
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Quotations waiting for an order ({pipeline.jobs.length})</h3>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    Given to the client, no work order received. Longest waiting first. A job leaves this list when its order comes in.
                                </p>
                            </div>
                            <div className="card-body p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-left px-4 py-2 w-36">Quotation</th>
                                            <th className="text-left px-3 py-2">Stakeholder</th>
                                            <th className="text-left px-3 py-2">Job</th>
                                            <th className="text-left px-3 py-2 w-28">Quoted on</th>
                                            <th className="text-right px-3 py-2 w-16">Days</th>
                                            <th className="text-left px-3 py-2 w-44">Status</th>
                                            <th className="text-right px-4 py-2 w-32">Quoted value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pipeline.jobs.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-10 text-sm text-surface-400">No quotation is waiting for an order.</td></tr>
                                        ) : pipeline.jobs.map((j: any) => (
                                            <tr key={j.id} className="border-b border-surface-50 hover:bg-surface-50/60 align-top">
                                                <td className="px-4 py-2.5">
                                                    <Link href={`/quotations/${j.quotation.id}`}
                                                        className="font-mono text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                        {j.quotation.ref}{j.quotation.version > 1 ? ` v${j.quotation.version}` : ''}
                                                    </Link>
                                                    {j.quotation.memo_no && (
                                                        <p className="text-[10px] text-surface-400 truncate max-w-[9rem]" title={j.quotation.memo_no}>{j.quotation.memo_no}</p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-surface-800">{j.customer ?? '—'}</td>
                                                <td className="px-3 py-2.5 text-surface-700">
                                                    <span className="line-clamp-2">{j.job ?? '—'}</span>
                                                    {j.more_items > 0 && <span className="text-[10px] text-surface-400">+{j.more_items} more item{j.more_items > 1 ? 's' : ''}</span>}
                                                    {j.rfq_id && <Link href={`/rfqs/${j.rfq_id}`} className="block text-[10px] text-surface-400 hover:text-brand-600">RFQ #{j.rfq_id}</Link>}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-nowrap">
                                                    {j.quoted_on ? new Date(j.quoted_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right font-mono ${AGE_TONE[j.ageing] ?? ''}`}>{j.days ?? '—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold ${STATE_TONE[j.state] ?? 'bg-surface-100 text-surface-600 border-surface-200'}`}>
                                                        {j.state_label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-surface-900">{taka(j.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {pipeline.jobs.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-surface-200 font-bold">
                                                <td className="px-4 py-2.5" colSpan={6}>Total</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">{taka(pipeline.total.value)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

/** A small breakdown: label, number of jobs, quoted value. */
function SummaryCard({ title, rows, dot, text }: {
    title: string; rows: { key: string; label: string; jobs: number; value: number }[];
    dot?: (k: string) => string; text?: (k: string) => string;
}) {
    return (
        <div className="card">
            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">{title}</h3></div>
            <div className="card-body p-0">
                <table className="w-full text-sm">
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.key} className={`border-b border-surface-50 last:border-0 ${r.jobs === 0 ? 'opacity-40' : ''}`}>
                                <td className="px-4 py-2">
                                    {dot
                                        ? <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-semibold ${dot(r.key)}`}>{r.label}</span>
                                        : <span className={text ? text(r.key) : 'text-surface-700'}>{r.label}</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-surface-500 w-14">{r.jobs}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold w-32">{taka(r.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
