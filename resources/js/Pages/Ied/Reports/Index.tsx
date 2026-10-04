import AppLayout from '@/Layouts/AppLayout';
import TargetAchievementPanel from '@/Components/Reports/TargetAchievementPanel';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const taka = (n: number) =>
    '৳ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const VIEWS = [
    { key: 'clients',    label: 'Client List' },
    { key: 'sector',     label: 'By Type & Sector' },
    { key: 'quotations', label: 'Quotation Value' },
    { key: 'pipeline',   label: 'Jobs in Pipeline' },
    // ⚠️ Target vs Achievement lives here rather than under the production
    // Reports group: BITAC set the yearly figure from IED, so the report and
    // the form that sets it belong on the same desk.
    { key: 'target',     label: 'Target vs Achievement' },
] as const;

/** One colour per pipeline stage, earliest to latest. Written out in full —
 *  Tailwind only ships classes it can see in the source. */
const STAGE_DOT: Record<string, string> = {
    quoted: 'bg-slate-400',
    wo_received: 'bg-sky-500',
    planning: 'bg-indigo-500',
    in_production: 'bg-violet-500',
    qc: 'bg-amber-500',
    ready: 'bg-emerald-500',
};

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft', ied_pending: 'Awaiting IED', pcd_pending: 'Production Planning',
    released_to_shops: 'Released to Shops', approved: 'Approved', in_production: 'In Production',
    qc_hold: 'QC Hold', qc_passed: 'QC Passed', ready_for_delivery: 'Ready for Delivery',
    partially_delivered: 'Partially Delivered',
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
                                    placeholder="Client name…" className="form-input text-sm w-56" />
                            </form>
                        )}
                        {view !== 'pipeline' && (
                            <p className="text-xs text-surface-400 ml-auto">{yearLabel}</p>
                        )}
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

                {/* ── Client list ───────────────────────────────────────── */}
                {view === 'clients' && clients && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Clients ({clients.length})</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Jobs and value are for {year}; the classification is current.
                            </p>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2">Client</th>
                                        <th className="text-left px-3 py-2 w-28">Type</th>
                                        <th className="text-left px-3 py-2 w-32">Sector</th>
                                        <th className="text-right px-3 py-2 w-16">Jobs</th>
                                        <th className="text-right px-3 py-2 w-32">Value</th>
                                        <th className="text-left px-4 py-2 w-28">Last job</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-sm text-surface-400">No clients found.</td></tr>
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

                {/* ── By type & sector ──────────────────────────────────── */}
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
                                    Counted from the date each quotation went to the customer. Drafts and superseded
                                    versions are excluded — a revised quotation would otherwise be counted twice.
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

                {/* ── Pipeline ──────────────────────────────────────────── */}
                {view === 'pipeline' && pipeline && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="card"><div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">In the pipeline</p>
                                <p className="text-xl font-bold text-surface-900 mt-1">{pipeline.total.jobs}</p>
                                <p className="text-[11px] text-surface-400 mt-1">
                                    {pipeline.total.quoted} quoted · {pipeline.total.work_orders} work order{pipeline.total.work_orders !== 1 ? 's' : ''}
                                </p>
                            </div></div>
                            <div className="card"><div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Quoted value in the pipe</p>
                                <p className="text-xl font-bold text-surface-900 mt-1">{taka(pipeline.total.value)}</p>
                                {pipeline.total.unquoted > 0 && (
                                    <p className="text-[11px] text-amber-600 font-semibold mt-1">
                                        {pipeline.total.unquoted} job{pipeline.total.unquoted !== 1 ? 's' : ''} not quoted yet — not in this figure
                                    </p>
                                )}
                            </div></div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">By stage</h3>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    From the quotation to the gate — everything neither delivered nor cancelled.
                                </p>
                            </div>
                            <div className="card-body p-0">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {pipeline.stages.map((s: any) => (
                                            <tr key={s.stage}
                                                className={`border-b border-surface-50 last:border-0 ${s.jobs === 0 ? 'opacity-40' : ''}`}>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle ${STAGE_DOT[s.stage] ?? 'bg-surface-300'}`} />
                                                    <span className="text-surface-700">{s.label}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-surface-500 w-16">{s.jobs}</td>
                                                <td className="px-4 py-2 text-right font-mono font-semibold w-32">{taka(s.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">In the pipeline ({pipeline.jobs.length})</h3>
                                <p className="text-xs text-surface-400 mt-0.5">In pipeline order, soonest due first.</p>
                            </div>
                            <div className="card-body p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-left px-4 py-2 w-40">Reference</th>
                                            <th className="text-left px-3 py-2">Customer</th>
                                            <th className="text-left px-3 py-2 w-40">Stage</th>
                                            <th className="text-left px-3 py-2 w-32">Quotation</th>
                                            <th className="text-left px-3 py-2 w-28">Due</th>
                                            <th className="text-right px-4 py-2 w-32">Quoted value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pipeline.jobs.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-10 text-sm text-surface-400">Nothing open.</td></tr>
                                        ) : pipeline.jobs.map((j: any) => (
                                            <tr key={j.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                                <td className="px-4 py-2.5">
                                                    {j.kind === 'quotation' ? (
                                                        <>
                                                            <Link href={`/quotations/${j.id}`}
                                                                className="font-mono text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                                {j.quotation.ref}
                                                            </Link>
                                                            {j.rfq_id && <p className="text-[10px] text-surface-400">RFQ #{j.rfq_id}</p>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Link href={`/work-orders/${j.id}`}
                                                                className="font-mono text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                                {j.wo_number}
                                                            </Link>
                                                            {j.job_number && <p className="text-[10px] text-surface-400">Job {j.job_number}</p>}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-surface-700">{j.customer ?? '—'}</td>
                                                <td className="px-3 py-2.5 text-xs">
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${STAGE_DOT[j.stage] ?? 'bg-surface-300'}`} />
                                                    <span className="text-surface-600">{j.stage_label}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs">
                                                    {j.quotation ? (
                                                        <>
                                                            <Link href={`/quotations/${j.quotation.id}`}
                                                                className="font-mono text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                                                                {j.quotation.ref}{j.quotation.version > 1 ? ` v${j.quotation.version}` : ''}
                                                            </Link>
                                                            {j.quotation.memo_no && (
                                                                <p className="text-[10px] text-surface-400 truncate max-w-[9rem]"
                                                                    title={j.quotation.memo_no}>{j.quotation.memo_no}</p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] font-semibold text-amber-600">not quoted</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs">
                                                    {j.due_date
                                                        ? <span className={j.overdue ? 'text-rose-600 font-semibold' : 'text-surface-500'}>
                                                            {j.due_date}{j.overdue ? ' · overdue' : ''}
                                                          </span>
                                                        : <span className="text-surface-300"
                                                            title={j.kind === 'quotation' ? 'Not ordered yet — nothing to be late for' : undefined}>—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums">
                                                    {j.quotation
                                                        ? <span className="font-semibold text-surface-900">{taka(j.value)}</span>
                                                        : <span className="text-surface-300">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
