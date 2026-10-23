import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { DEMAND_BADGE, mrBadge, mrLabel } from '@/lib/mrStatus';

/** The shops' material demands — a shop sees its own; PCD sees every shop's, oldest unanswered first. */
export default function MaterialDemandIndex({ demands, filters, waitingCount, canRaise, canDecide, shops }: any) {
    const rows = demands?.data ?? [];
    const [search, setSearch] = useState(filters?.search ?? '');
    const go = (patch: Record<string, any>) =>
        router.get('/material-demands', { tab: filters.tab, section_id: filters.section_id ?? '', search, ...patch }, { preserveState: true, replace: true });
    const runSearch = (e: FormEvent) => { e.preventDefault(); go({ search }); };

    return (
        <AppLayout header="Material Demands">
            <div className="space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Material Demands</h1>
                        <p className="page-subtitle">
                            {canDecide ? 'What the shops have asked for. Raise a requisition to the store from a demand, or reject it.'
                                : 'Ask PCD for the material a job needs, and follow it to the store.'}
                        </p>
                    </div>
                    {canRaise && (
                        <Link href="/material-demands/create" className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New demand
                        </Link>
                    )}
                </div>

                <div className="card">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100 flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="inline-flex rounded-xl bg-surface-100 p-1 shrink-0">
                            {[['open', `Open${waitingCount ? ` · ${waitingCount} waiting` : ''}`], ['all', 'All']].map(([k, label]) => (
                                <button key={k} type="button" onClick={() => go({ tab: k })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filters.tab === k ? 'bg-white shadow-sm text-surface-900' : 'text-surface-600 hover:text-surface-900'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={runSearch} className="flex flex-1 flex-col sm:flex-row gap-2">
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Demand no., work order or job…"
                                className="form-input !py-2 text-sm flex-1" />
                            {shops.length > 1 && (
                                <select value={filters.section_id ?? ''} onChange={(e) => go({ section_id: e.target.value })} className="form-select !py-2 text-sm sm:w-48">
                                    <option value="">All shops</option>
                                    {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}
                            <button type="submit" className="btn-outline btn-sm">Search</button>
                        </form>
                    </div>

                    {rows.length === 0 ? (
                        <div className="empty-state py-14">
                            <div className="empty-state-icon"><i className="fi fi-rr-boxes" /></div>
                            <div className="empty-state-title">{filters.tab === 'open' ? 'Nothing open' : 'No demands yet'}</div>
                            <div className="empty-state-text">
                                {canRaise ? 'A shop raises one from here, or from Request Material on a job.' : 'Demands from the shops will appear here.'}
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="premium-table w-full min-w-[900px]">
                                <thead>
                                    <tr>
                                        <th>Demand</th>
                                        <th>Shop</th>
                                        <th>Job</th>
                                        <th className="text-center">Lines</th>
                                        <th>Needed by</th>
                                        <th>Status</th>
                                        <th>Requisition</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((d: any) => (
                                        <tr key={d.id} className="cursor-pointer" onClick={() => router.visit(`/material-demands/${d.id}`)}>
                                            <td>
                                                <div className="font-mono font-semibold text-brand-600">{d.demand_no}</div>
                                                <div className="text-[11px] text-surface-500">{d.created}{d.requested_by ? ` · ${d.requested_by}` : ''}</div>
                                            </td>
                                            <td className="text-surface-800">{d.shop}</td>
                                            <td>
                                                <div className="font-mono text-sm">{d.work_order?.wo_number}</div>
                                                <div className="text-[11px] text-surface-500 truncate max-w-[220px]">
                                                    {d.work_order?.job_number ? `Job ${d.work_order.job_number} · ` : ''}{d.work_order?.customer}
                                                </div>
                                            </td>
                                            <td className="text-center">{d.item_count}</td>
                                            <td className={d.overdue ? 'text-red-600 font-semibold' : 'text-surface-700'}>{d.needed_by ?? '—'}</td>
                                            <td><span className={`badge ${DEMAND_BADGE[d.status] ?? 'badge-slate'}`}>{d.status_label}</span></td>
                                            <td>
                                                {d.requisition ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-mono text-xs">{d.requisition.mrn_number}</span>
                                                        <span className={`badge ${mrBadge(d.requisition.status)}`}>{mrLabel(d.requisition.status)}</span>
                                                    </span>
                                                ) : <span className="text-surface-300">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {demands?.last_page > 1 && (
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between text-xs text-surface-500">
                            <span>Page {demands.current_page} of {demands.last_page} · {demands.total} demands</span>
                            <div className="flex gap-1">
                                {demands.prev_page_url && <Link href={demands.prev_page_url} className="btn-outline btn-xs">Previous</Link>}
                                {demands.next_page_url && <Link href={demands.next_page_url} className="btn-outline btn-xs">Next</Link>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
