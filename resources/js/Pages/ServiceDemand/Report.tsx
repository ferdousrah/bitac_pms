import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';

const VOLUME_LABEL: Record<string, string> = {
    one_time:   'One-time',
    occasional: 'Occasional',
    frequent:   'Frequent',
    regular:    'Regular / Ongoing',
};

export default function ServiceDemandReport({
    year, availableYears, categories, summary,
    topServices, byCategory, byValue, byVolume, monthly, topOrgs, investmentHints,
}: any) {
    const maxMonthly = Math.max(1, ...monthly.map((m: any) => m.count));

    return (
        <AppLayout header={`Service Demand Report — ${year}`}>
            <div className="max-w-6xl space-y-6 animate-fade-in">

                <Link href="/ied/service-demand" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to log
                </Link>

                {/* Year + Export */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-chart-line-up text-base leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-900">Service Demand — Annual Strategic Report</h2>
                                <p className="text-[11px] text-surface-400 mt-0.5">What BITAC's market is asking for that we don't yet offer.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select value={year}
                                onChange={e => router.get('/ied/service-demand/report', { year: e.target.value })}
                                className="form-select w-auto font-mono">
                                {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <a href={`/ied/service-demand/report/export?year=${year}`} className="btn-outline btn-sm">
                                <i className="fi fi-rr-download text-xs leading-none" /> Export CSV
                            </a>
                            <button onClick={() => window.print()} className="btn-outline btn-sm">
                                <i className="fi fi-rr-print text-xs leading-none" /> Print
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryTile label="Total Entries"      value={summary.total}      color="indigo" />
                    <SummaryTile label="High-Value Requests" value={summary.high_value} color="emerald" />
                    <SummaryTile label="Frequent / Regular" value={summary.frequent}   color="amber" />
                    <SummaryTile label="Unique Services"    value={summary.unique_svc} color="purple" />
                </div>

                {/* Investment hints — actionable */}
                {investmentHints.length > 0 && (
                    <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/40">
                        <div className="card-header bg-transparent">
                            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                <i className="fi fi-rr-bullseye text-base leading-none" /> Strategic Investment Hints
                            </h3>
                            <p className="text-[11px] text-emerald-700/80 mt-0.5">
                                Services with both HIGH potential value AND frequent/regular volume — the strongest candidates for capability investment.
                            </p>
                        </div>
                        <div className="card-body space-y-2">
                            {investmentHints.map((h: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 bg-white/70 backdrop-blur border border-emerald-200/50 rounded-lg p-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-emerald-900">{h.requested_service}</div>
                                        <div className="text-[10px] text-emerald-700/80">
                                            <span className="font-mono font-bold">{h.cnt}</span> requests · high-value · frequent volume
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top services ranked */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Top 15 Most-Requested Services</h3>
                        <p className="text-[11px] text-surface-400 mt-0.5">Ranked by request count for {year}.</p>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th className="w-12 text-center">#</th>
                                    <th>Service</th>
                                    <th className="text-center">Requests</th>
                                    <th className="text-center">High-Value</th>
                                    <th className="text-center">Frequent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topServices.length === 0 ? (
                                    <tr><td colSpan={5}>
                                        <div className="empty-state">
                                            <p className="empty-state-text">No entries logged in {year}.</p>
                                        </div>
                                    </td></tr>
                                ) : topServices.map((s: any, i: number) => (
                                    <tr key={i}>
                                        <td className="text-center text-surface-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="font-medium text-surface-900">{s.requested_service}</td>
                                        <td className="text-center font-mono font-bold text-indigo-600">{s.cnt}</td>
                                        <td className="text-center text-xs">
                                            {Number(s.high_cnt) > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                                    {s.high_cnt}/{s.cnt}
                                                </span>
                                            ) : <span className="text-surface-300">—</span>}
                                        </td>
                                        <td className="text-center text-xs">
                                            {Number(s.freq_cnt) > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px]">
                                                    {s.freq_cnt}/{s.cnt}
                                                </span>
                                            ) : <span className="text-surface-300">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* By Category + By Volume side-by-side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">By Service Category</h3></div>
                        <div className="card-body space-y-3">
                            <Bars data={Object.entries(byCategory).map(([k, v]: any) => ({
                                label: categories[k] ?? k, value: v as number
                            }))} />
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">By Expected Volume</h3></div>
                        <div className="card-body space-y-3">
                            <Bars data={Object.entries(byVolume).map(([k, v]: any) => ({
                                label: VOLUME_LABEL[k] ?? k, value: v as number
                            }))} color="emerald" />
                        </div>
                    </div>
                </div>

                {/* Monthly trend */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Monthly Trend</h3>
                        <p className="text-[11px] text-surface-400 mt-0.5">When are people asking for services BITAC doesn't have?</p>
                    </div>
                    <div className="card-body">
                        <div className="flex items-end gap-1 h-44 mt-2">
                            {monthly.map((m: any) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                                    <div className="text-[10px] font-mono font-bold text-surface-500">{m.count > 0 ? m.count : ''}</div>
                                    <div className="w-3/5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t"
                                        style={{ height: `${(m.count / maxMonthly) * 100}%`, minHeight: m.count ? '2px' : '0' }} />
                                    <div className="text-[10px] text-surface-400 font-semibold">{m.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top organisations */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Top 10 Organisations Asking</h3>
                        <p className="text-[11px] text-surface-400 mt-0.5">Who keeps coming back asking for capabilities BITAC doesn't have?</p>
                    </div>
                    <div className="card-body p-0">
                        {topOrgs.length === 0 ? (
                            <div className="px-5 py-8 text-center text-xs text-surface-400">No organisations recorded for {year}.</div>
                        ) : (
                            <ul className="divide-y divide-surface-100">
                                {topOrgs.map((o: any, i: number) => (
                                    <li key={i} className="px-5 py-3 flex items-center gap-3">
                                        <span className="font-mono text-xs font-bold text-surface-400 w-6 text-center">{String(i + 1).padStart(2, '0')}</span>
                                        <span className="flex-1 text-sm text-surface-700 truncate">{o.requester_organization}</span>
                                        <span className="font-mono text-xs font-bold text-indigo-600">{o.cnt}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function SummaryTile({ label, value, color }: any) {
    const bg: Record<string, string> = {
        indigo:  'bg-indigo-50  text-indigo-700  border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber:   'bg-amber-50   text-amber-700   border-amber-100',
        purple:  'bg-purple-50  text-purple-700  border-purple-100',
    };
    return (
        <div className={`rounded-2xl border p-4 ${bg[color]}`}>
            <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</div>
            <div className="text-3xl font-bold font-mono mt-1 leading-none">{value}</div>
        </div>
    );
}

function Bars({ data, color = 'indigo' }: { data: any[]; color?: string }) {
    const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
    const colors: Record<string, string> = {
        indigo:  'bg-gradient-to-r from-indigo-500 to-indigo-400',
        emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    };
    if (data.length === 0) return <p className="text-xs text-surface-400 text-center py-3">No data.</p>;
    return (
        <>
            {data.map((d, i) => (
                <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-surface-700 font-semibold">{d.label}</span>
                        <span className="font-mono font-bold text-surface-900">{d.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                        <div className={`h-full ${colors[color]} rounded-full transition-all`}
                            style={{ width: `${(d.value / total) * 100}%`, minWidth: d.value ? '4px' : '0' }} />
                    </div>
                </div>
            ))}
        </>
    );
}
