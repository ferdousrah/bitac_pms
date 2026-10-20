import { router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

/**
 * IED → Reports → Factory Visited / Factory to be Visited.
 *
 * One register behind both: a planned visit, once it happens, is "Marked as
 * visited" and moves from the to-be-visited list into the visited one —
 * nothing is typed twice. A visit nobody planned is added as visited directly.
 */
export interface Visit {
    id: number; customer_id: number | null; factory_name: string; visitors: string;
    visit_work: string | null; remarks: string | null; planned_date: string | null;
    visited_on: string | null; date: string; month: string; overdue: boolean;
}
interface Data {
    total: { visits: number; factories: number; overdue: number };
    months: { month: string; label: string; visits: number; factories: number }[];
    visits: Visit[];
}
type Mode = { type: 'add' } | { type: 'edit'; visit: Visit } | { type: 'mark'; visit: Visit };

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FactoryVisitsPanel({ kind, data, canManage, stakeholders, year, centerId }: {
    kind: 'visited' | 'tovisit'; data: Data; canManage: boolean;
    stakeholders: { id: number; name: string }[]; year: string; centerId: number | null;
}) {
    const [mode, setMode] = useState<Mode | null>(null);
    const visited = kind === 'visited';
    const ctx = { year, center_id: centerId ?? '' };

    const remove = (v: Visit) => {
        if (confirm(`Remove ${visited ? 'the visit to' : 'the planned visit to'} ${v.factory_name} on ${fmt(v.date)}?`)) {
            router.delete(`/ied/factory-visits/${v.id}`, { data: ctx, preserveScroll: true });
        }
    };

    // Group the list by month, in date order, so it reads like the paper register.
    const byMonth = useMemo(() => {
        const g: Record<string, Visit[]> = {};
        data.visits.forEach(v => { (g[v.month] ??= []).push(v); });
        return data.months.filter(m => g[m.month]?.length).map(m => ({ ...m, rows: g[m.month] }));
    }, [data]);

    let sl = 0;

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Tile label={visited ? 'Visits' : 'Visits planned'} value={data.total.visits} />
                <Tile label="Factories" value={data.total.factories} note="each counted once" />
                {!visited && <Tile label="Date passed" value={data.total.overdue} note="not marked visited yet" warn={data.total.overdue > 0} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <div className="card">
                    <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Month by month</h3></div>
                    <div className="card-body p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                    <th className="text-left px-4 py-2">Month</th>
                                    <th className="text-right px-3 py-2">{visited ? 'Visits' : 'Planned'}</th>
                                    <th className="text-right px-4 py-2">Factories</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.months.map(m => (
                                    <tr key={m.month} className={`border-b border-surface-50 last:border-0 ${m.visits ? '' : 'text-surface-300'}`}>
                                        <td className="px-4 py-2">{m.label}</td>
                                        <td className="px-3 py-2 text-right font-mono">{m.visits || '—'}</td>
                                        <td className="px-4 py-2 text-right font-mono">{m.factories || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-surface-200 font-bold">
                                    <td className="px-4 py-2">Total</td>
                                    <td className="px-3 py-2 text-right font-mono">{data.total.visits}</td>
                                    <td className="px-4 py-2 text-right font-mono">{data.total.factories}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="card lg:col-span-2">
                    <div className="card-header flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">
                                {visited ? 'Factories visited' : 'Factories to be visited'} ({data.visits.length})
                            </h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {visited
                                    ? 'Planned visits marked as visited appear here, with any visit added directly.'
                                    : 'When a visit has taken place, mark it as visited — it moves to Factory Visited.'}
                            </p>
                        </div>
                        {canManage && (
                            <button onClick={() => setMode({ type: 'add' })} className="btn-primary btn-sm shrink-0">
                                <i className="fi fi-rr-plus text-xs leading-none" /> {visited ? 'Add visit' : 'Plan a visit'}
                            </button>
                        )}
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                    <th className="text-right px-3 py-2 w-10">Sl</th>
                                    <th className="text-left px-3 py-2">{visited ? 'Name of Factory' : 'Name of Factory to be Visited'}</th>
                                    <th className="text-left px-3 py-2">Visitors</th>
                                    {visited && <th className="text-left px-3 py-2">Visited Work</th>}
                                    <th className="text-left px-3 py-2 w-28">Date</th>
                                    <th className="text-left px-3 py-2">Remarks</th>
                                    {canManage && <th className="w-24" />}
                                </tr>
                            </thead>
                            <tbody>
                                {byMonth.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-sm text-surface-400">
                                        {visited ? 'No factory visit recorded in this year.' : 'No factory visit planned in this year.'}
                                    </td></tr>
                                ) : byMonth.map(m => (
                                    <MonthRows key={m.month} label={m.label} count={m.rows.length} cols={(visited ? 6 : 5) + (canManage ? 1 : 0)}>
                                        {m.rows.map(v => (
                                            <tr key={v.id} className="border-b border-surface-50 align-top hover:bg-surface-50/60">
                                                <td className="px-3 py-2.5 text-right font-mono text-surface-500">{++sl}</td>
                                                <td className="px-3 py-2.5 font-semibold text-surface-900">{v.factory_name}</td>
                                                <td className="px-3 py-2.5 text-surface-700">{v.visitors}</td>
                                                {visited && <td className="px-3 py-2.5 text-surface-700 whitespace-pre-line">{v.visit_work ?? '—'}</td>}
                                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                                    <span className={v.overdue ? 'text-rose-600 font-semibold' : 'text-surface-600'}>{fmt(v.date)}</span>
                                                    {v.overdue && <span className="block text-[10px] text-rose-600">date passed</span>}
                                                    {visited && v.planned_date && v.planned_date !== v.visited_on && (
                                                        <span className="block text-[10px] text-surface-400">planned {fmt(v.planned_date)}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-pre-line">{v.remarks ?? '—'}</td>
                                                {canManage && (
                                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                                        {!visited && (
                                                            <button onClick={() => setMode({ type: 'mark', visit: v })}
                                                                    className="btn-ghost btn-xs text-emerald-700 hover:bg-emerald-50" title="Mark as visited">
                                                                <i className="fi fi-rr-check text-[11px] leading-none" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => setMode({ type: 'edit', visit: v })} className="btn-ghost btn-xs" title="Edit">
                                                            <i className="fi fi-rr-edit text-[11px] leading-none" />
                                                        </button>
                                                        <button onClick={() => remove(v)} className="btn-ghost btn-xs text-rose-600 hover:bg-rose-50" title="Remove">
                                                            <i className="fi fi-rr-trash text-[11px] leading-none" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </MonthRows>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {mode && <VisitModal kind={kind} mode={mode} stakeholders={stakeholders} ctx={ctx} onClose={() => setMode(null)} />}
        </>
    );
}

function MonthRows({ label, count, cols, children }: { label: string; count: number; cols: number; children: any }) {
    return (
        <>
            <tr className="bg-surface-50 border-b border-surface-100">
                <td colSpan={cols} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-surface-600">
                    {label} <span className="text-surface-400 font-semibold normal-case tracking-normal">· {count}</span>
                </td>
            </tr>
            {children}
        </>
    );
}

function Tile({ label, value, note, warn = false }: { label: string; value: number; note?: string; warn?: boolean }) {
    return (
        <div className="card"><div className="card-body">
            <p className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">{label}</p>
            <p className={`text-xl font-bold mt-1 ${warn ? 'text-rose-600' : 'text-surface-900'}`}>{value}</p>
            {note && <p className="text-[11px] text-surface-400 mt-1">{note}</p>}
        </div></div>
    );
}

/** Add (planned or visited), edit, or mark a planned visit as visited. */
function VisitModal({ kind, mode, stakeholders, ctx, onClose }: {
    kind: 'visited' | 'tovisit'; mode: Mode; stakeholders: { id: number; name: string }[];
    ctx: Record<string, any>; onClose: () => void;
}) {
    const v = mode.type === 'add' ? null : mode.visit;
    const marking = mode.type === 'mark';
    // What the form records: a visit that happened, or a plan.
    const asVisited = marking || (mode.type === 'add' ? kind === 'visited' : kind === 'visited');
    const today = new Date().toISOString().slice(0, 10);
    const knownCustomer = v?.customer_id && stakeholders.some(s => s.id === v.customer_id);
    const [other, setOther] = useState<boolean>(!!v && !knownCustomer);

    const { data, setData, post, put, processing, errors, transform } = useForm({
        kind: asVisited ? 'visited' : 'planned',
        customer_id: knownCustomer ? String(v!.customer_id) : '',
        factory_name: v && !knownCustomer ? v.factory_name : '',
        visitors: v?.visitors ?? '',
        planned_date: v?.planned_date ?? '',
        visited_on: marking ? today : (v?.visited_on ?? (asVisited ? today : '')),
        visit_work: v?.visit_work ?? '',
        remarks: v?.remarks ?? '',
        ...ctx,
    });

    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform(d => ({ ...d, customer_id: other ? '' : d.customer_id, factory_name: other ? d.factory_name : '' }));
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (marking) post(`/ied/factory-visits/${v!.id}/visited`, opts);
        else if (v) put(`/ied/factory-visits/${v.id}`, opts);
        else post('/ied/factory-visits', opts);
    };

    const title = marking ? `Mark as visited — ${v!.factory_name}`
        : v ? `Edit ${asVisited ? 'visit' : 'planned visit'}`
        : asVisited ? 'Add a factory visit' : 'Plan a factory visit';

    return (
        <div className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl my-8">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-surface-900">{title}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            {marking ? 'It moves to Factory Visited.' : asVisited ? 'পরিদর্শিত কারখানা' : 'পরিদর্শিতব্য কারখানা'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-100 flex items-center justify-center text-surface-500" aria-label="Close">
                        <i className="fi fi-rr-cross-small text-lg leading-none" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {!marking && (
                        <div>
                            <label className="form-label">Name of Factory <span className="text-rose-600">*</span></label>
                            {!other ? (
                                <select value={data.customer_id} onChange={e => {
                                            if (e.target.value === '__other') { setOther(true); setData('customer_id', ''); }
                                            else setData('customer_id', e.target.value);
                                        }}
                                        className="form-select w-full" autoFocus>
                                    <option value="">Choose a factory…</option>
                                    {stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    <option value="__other">Other factory (not in the list)…</option>
                                </select>
                            ) : (
                                <div className="flex gap-2">
                                    <input value={data.factory_name} onChange={e => setData('factory_name', e.target.value)}
                                           className="form-input flex-1" maxLength={200} placeholder="Factory name" autoFocus />
                                    <button type="button" onClick={() => { setOther(false); setData('factory_name', ''); }}
                                            className="btn-ghost btn-sm shrink-0">From the list</button>
                                </div>
                            )}
                            {(errors.factory_name || errors.customer_id) && <p className="form-error">{errors.factory_name || errors.customer_id}</p>}
                        </div>
                    )}

                    <div>
                        <label className="form-label">Visitors Name <span className="text-rose-600">*</span></label>
                        <input value={data.visitors} onChange={e => setData('visitors', e.target.value)} className="form-input w-full" maxLength={500}
                               placeholder="The officer, or the members of the delegation" />
                        {errors.visitors && <p className="form-error">{errors.visitors}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(!asVisited || (v && v.planned_date && !marking)) && (
                            <div>
                                <label className="form-label">{asVisited ? 'Planned date' : <>Date <span className="text-rose-600">*</span></>}</label>
                                <input type="date" value={data.planned_date ?? ''} onChange={e => setData('planned_date', e.target.value)} className="form-input w-full" />
                                {errors.planned_date && <p className="form-error">{errors.planned_date}</p>}
                            </div>
                        )}
                        {asVisited && (
                            <div>
                                <label className="form-label">Date visited <span className="text-rose-600">*</span></label>
                                <input type="date" max={today} value={data.visited_on ?? ''} onChange={e => setData('visited_on', e.target.value)} className="form-input w-full" />
                                {errors.visited_on && <p className="form-error">{errors.visited_on}</p>}
                            </div>
                        )}
                    </div>

                    {asVisited && (
                        <div>
                            <label className="form-label">Visited Work <span className="text-rose-600">*</span></label>
                            <textarea value={data.visit_work} onChange={e => setData('visit_work', e.target.value)} rows={3} className="form-textarea w-full"
                                      maxLength={5000} placeholder="What was seen or done — inspection, survey, discussion of a job…" />
                            {errors.visit_work && <p className="form-error">{errors.visit_work}</p>}
                        </div>
                    )}

                    <div>
                        <label className="form-label">Remarks</label>
                        <textarea value={data.remarks} onChange={e => setData('remarks', e.target.value)} rows={2} className="form-textarea w-full" maxLength={2000} />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" disabled={processing} className="btn-primary disabled:opacity-50">
                        {processing ? 'Saving…' : marking ? 'Mark as visited' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}
