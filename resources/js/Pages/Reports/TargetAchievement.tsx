import AppLayout from '@/Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Row {
    center_id: number;
    center: string;
    target: number;
    achieved: number;
    work_orders: number;
    percent: number;
    gap: number;
}

const taka = (n: number) =>
    '৳ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const barColour = (pct: number) =>
    pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-brand-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

export default function TargetAchievement({
    year, yearLabel, years, rows, totals, canSetFor = [], isSuperAdmin = false,
}: any) {
    const [openFor, setOpenFor] = useState<Row | null>(null);
    const [breakdown, setBreakdown] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);

    const form = useForm({
        center_id: canSetFor[0]?.id ?? '',
        financial_year: year,
        target_amount: '',
        note: '',
    });

    const changeYear = (y: string) =>
        router.get('/reports/target-achievement', { year: y }, { preserveState: false });

    const saveTarget = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d: any) => ({ ...d, financial_year: year }));
        form.post('/reports/target-achievement', {
            preserveScroll: true,
            onSuccess: () => form.setData('target_amount', ''),
        });
    };

    // The work orders behind a figure — a total nobody can trace is a total
    // nobody trusts.
    const showBreakdown = async (r: Row) => {
        setOpenFor(r);
        setBreakdown(null);
        setLoading(true);
        try {
            const res = await fetch(`/reports/target-achievement/${r.center_id}/breakdown?year=${year}`, {
                headers: { Accept: 'application/json' },
            });
            const json = await res.json();
            setBreakdown(json.workOrders ?? []);
        } catch {
            setBreakdown([]);
        } finally {
            setLoading(false);
        }
    };

    const overallPct = totals.target > 0 ? Math.round((totals.achieved / totals.target) * 1000) / 10 : 0;

    return (
        <AppLayout header="Target vs Achievement">
            <Head title="Target vs Achievement" />

            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

                {/* Year picker */}
                <div className="card">
                    <div className="card-body flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <label className="form-label !mb-1">Financial Year</label>
                            <select value={year} onChange={(e) => changeYear(e.target.value)}
                                className="form-input text-sm w-72">
                                {years.map((y: any) => (
                                    <option key={y.value} value={y.value}>{y.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Running</p>
                            <p className="text-sm font-semibold text-surface-700">{yearLabel}</p>
                        </div>
                    </div>
                </div>

                {/* Headline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Target', value: taka(totals.target), tone: 'text-surface-900' },
                        { label: 'Achieved', value: taka(totals.achieved), tone: 'text-emerald-700' },
                        { label: 'Work Orders', value: String(totals.work_orders), tone: 'text-surface-900' },
                    ].map((t) => (
                        <div key={t.label} className="card">
                            <div className="card-body">
                                <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">{t.label}</p>
                                <p className={`text-xl font-bold mt-1 ${t.tone}`}>{t.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {totals.target > 0 && (
                    <div className="card">
                        <div className="card-body">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-semibold text-surface-700">Overall</span>
                                <span className="font-mono font-bold text-surface-900">{overallPct}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-surface-100 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColour(overallPct)}`}
                                    style={{ width: `${Math.min(overallPct, 100)}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Per centre */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">
                            {isSuperAdmin ? 'By Centre' : 'Your Centre'}
                        </h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Achievement is the value of work orders received, taken from the quotation each one was
                            issued against. Click a row to see the work orders behind it.
                        </p>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                    <th className="text-left px-4 py-2">Centre</th>
                                    <th className="text-right px-3 py-2">Target</th>
                                    <th className="text-right px-3 py-2">Achieved</th>
                                    <th className="text-left px-3 py-2 w-40">Progress</th>
                                    <th className="text-right px-3 py-2">Gap</th>
                                    <th className="text-right px-4 py-2">WOs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: Row) => (
                                    <tr key={r.center_id} onClick={() => showBreakdown(r)}
                                        className="border-b border-surface-50 hover:bg-surface-50/60 cursor-pointer">
                                        <td className="px-4 py-3 font-semibold text-surface-900">{r.center}</td>
                                        <td className="px-3 py-3 text-right font-mono">
                                            {r.target > 0 ? taka(r.target)
                                                : <span className="text-surface-400 italic text-xs">not set</span>}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono font-semibold">{taka(r.achieved)}</td>
                                        <td className="px-3 py-3">
                                            {r.target > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 flex-1 rounded-full bg-surface-100 overflow-hidden">
                                                        <div className={`h-full rounded-full ${barColour(r.percent)}`}
                                                            style={{ width: `${Math.min(r.percent, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-mono text-surface-600 w-12 text-right">{r.percent}%</span>
                                                </div>
                                            ) : <span className="text-xs text-surface-400">—</span>}
                                        </td>
                                        <td className={`px-3 py-3 text-right font-mono ${r.gap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {r.target > 0 ? taka(Math.abs(r.gap)) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-surface-600">{r.work_orders}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Set the target */}
                {canSetFor.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Set target for {year}</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                One figure per centre per financial year. Saving again replaces it.
                            </p>
                        </div>
                        <form onSubmit={saveTarget} className="card-body grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div className="form-group !mb-0">
                                <label className="form-label">Centre</label>
                                <select value={form.data.center_id} disabled={canSetFor.length === 1}
                                    onChange={(e) => form.setData('center_id', e.target.value)}
                                    className="form-input disabled:bg-surface-50">
                                    {canSetFor.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Target (৳)</label>
                                <input type="number" min="0" step="0.01" value={form.data.target_amount}
                                    onChange={(e) => form.setData('target_amount', e.target.value)}
                                    className="form-input font-mono" placeholder="0.00" />
                                {form.errors.target_amount && <p className="form-error">{form.errors.target_amount}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Note <span className="form-label-optional">Optional</span></label>
                                <input value={form.data.note} onChange={(e) => form.setData('note', e.target.value)}
                                    className="form-input" placeholder="e.g. approved in board meeting" />
                            </div>
                            <button type="submit" disabled={form.processing} className="btn-primary">
                                Save target
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Breakdown */}
            {openFor && (
                <>
                    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setOpenFor(null)} />
                    <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto">
                            <div className="p-5 border-b border-surface-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">{openFor.center} — {year}</h3>
                                    <p className="text-[11px] text-surface-500">
                                        {openFor.work_orders} work order(s) · {taka(openFor.achieved)}
                                    </p>
                                </div>
                                <button onClick={() => setOpenFor(null)} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto">
                                {loading ? (
                                    <p className="text-sm text-surface-400 text-center py-8">Loading…</p>
                                ) : (breakdown ?? []).length === 0 ? (
                                    <p className="text-sm text-surface-400 text-center py-8">
                                        No work orders counted in this year.
                                    </p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                                <th className="text-left px-2 py-2">WO</th>
                                                <th className="text-left px-2 py-2">Customer</th>
                                                <th className="text-left px-2 py-2">WO date</th>
                                                <th className="text-left px-2 py-2">From</th>
                                                <th className="text-right px-2 py-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdown!.map((w: any) => (
                                                <tr key={w.id} className="border-b border-surface-50">
                                                    <td className="px-2 py-2 font-mono text-xs">{w.wo_number}</td>
                                                    <td className="px-2 py-2">{w.customer ?? '—'}</td>
                                                    <td className="px-2 py-2 text-xs">
                                                        {w.wo_date}
                                                        {/* Flag rows dated by when they were keyed in. */}
                                                        {Number(w.date_is_fallback) === 1 && (
                                                            <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                                                                title="No customer WO date recorded — using the date it was entered">
                                                                entered
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-xs text-surface-500">
                                                        Quotation #{w.quotation_id} v{w.quotation_version}
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-mono">{taka(w.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}
