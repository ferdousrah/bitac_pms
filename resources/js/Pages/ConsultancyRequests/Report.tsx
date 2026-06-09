import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';

const TYPE_LABEL: Record<string, string> = {
    student: 'Students',
    consultancy: 'Consultancy Seekers',
    organization: 'Organizations',
};

const MODE_LABEL: Record<string, string> = {
    in_person: 'In-person',
    online: 'Online',
    written: 'Written',
};

export default function ConsultancyRequestsReport({ year, availableYears, summary, byType, byMode, monthly, topSubjects }: any) {
    const maxMonthly = Math.max(1, ...monthly.map((m: any) => Math.max(m.submitted, m.completed)));

    return (
        <AppLayout header={`Consultancy Annual Report — ${year}`}>
            <div className="max-w-6xl space-y-6 animate-fade-in">

                <Link href="/ied/consultancy-requests" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to inbox
                </Link>

                {/* Year picker + export */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-stats text-base leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-900">Annual Consultancy &amp; Student-Assistance Report</h2>
                                <p className="text-[11px] text-surface-400 mt-0.5">Aggregate statistics for ministry / management reporting.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select value={year}
                                onChange={e => router.get('/ied/consultancy-requests/report', { year: e.target.value })}
                                className="form-select w-auto font-mono">
                                {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <a href={`/ied/consultancy-requests/report/export?year=${year}`}
                                className="btn-outline btn-sm">
                                <i className="fi fi-rr-download text-xs leading-none" /> Export CSV
                            </a>
                            <a href={`/ied/consultancy-requests/report?year=${year}&print=1`}
                                onClick={(e) => { e.preventDefault(); window.print(); }}
                                className="btn-outline btn-sm">
                                <i className="fi fi-rr-print text-xs leading-none" /> Print
                            </a>
                        </div>
                    </div>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryTile label="Total Submitted" value={summary.total}     color="indigo" />
                    <SummaryTile label="Accepted"        value={summary.accepted}  color="blue" />
                    <SummaryTile label="Completed"       value={summary.completed} color="emerald" />
                    <SummaryTile label="Rejected"        value={summary.rejected}  color="rose" />
                    <SummaryTile label="Pending"         value={summary.pending}   color="amber" />
                </div>

                {/* Breakdowns row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">By Requester Type</h3></div>
                        <div className="card-body space-y-3">
                            <Bars data={Object.entries(byType).map(([k, v]: any) => ({
                                label: TYPE_LABEL[k] ?? k, value: v as number
                            }))} />
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">By Preferred Mode</h3></div>
                        <div className="card-body space-y-3">
                            <Bars data={Object.entries(byMode).map(([k, v]: any) => ({
                                label: MODE_LABEL[k] ?? k, value: v as number
                            }))} color="emerald" />
                        </div>
                    </div>
                </div>

                {/* Monthly trend */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Monthly Trend</h3>
                        <p className="text-[11px] text-surface-400 mt-0.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 align-middle mr-1" /> Submitted
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 align-middle mr-1 ml-3" /> Completed
                        </p>
                    </div>
                    <div className="card-body">
                        <div className="flex items-end gap-1 h-44 mt-2">
                            {monthly.map((m: any) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                                    <div className="flex items-end gap-0.5 w-full justify-center h-full">
                                        <div className="w-2/5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t"
                                            style={{ height: `${(m.submitted / maxMonthly) * 100}%`, minHeight: m.submitted ? '2px' : '0' }}
                                            title={`${m.submitted} submitted in ${m.label}`} />
                                        <div className="w-2/5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t"
                                            style={{ height: `${(m.completed / maxMonthly) * 100}%`, minHeight: m.completed ? '2px' : '0' }}
                                            title={`${m.completed} completed in ${m.label}`} />
                                    </div>
                                    <div className="text-[10px] text-surface-400 font-semibold">{m.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top subjects */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Top 10 Subjects</h3>
                        <p className="text-[11px] text-surface-400 mt-0.5">Most common consultancy themes in {year}.</p>
                    </div>
                    <div className="card-body p-0">
                        {topSubjects.length === 0 ? (
                            <div className="px-5 py-8 text-center text-xs text-surface-400">No data for {year}.</div>
                        ) : (
                            <ul className="divide-y divide-surface-100">
                                {topSubjects.map((s: any, i: number) => (
                                    <li key={i} className="px-5 py-3 flex items-center gap-3">
                                        <span className="font-mono text-xs font-bold text-surface-400 w-6 text-center">{String(i + 1).padStart(2, '0')}</span>
                                        <span className="flex-1 text-sm text-surface-700 truncate">{s.subject}</span>
                                        <span className="font-mono text-xs font-bold text-indigo-600">{s.cnt}</span>
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
        blue:    'bg-blue-50    text-blue-700    border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber:   'bg-amber-50   text-amber-700   border-amber-100',
        rose:    'bg-rose-50    text-rose-700    border-rose-100',
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
