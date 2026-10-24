import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    issued: 'badge-green', pending_approval: 'badge-amber', rejected: 'badge-red',
    completed: 'badge-blue', cancelled: 'badge-red', partially_returned: 'badge-amber', draft: 'badge-slate',
};
const STATUS_LABEL: Record<string, string> = {
    issued: 'Issued', pending_approval: 'Awaiting approval', rejected: 'Rejected',
    completed: 'Completed', cancelled: 'Cancelled', partially_returned: 'Partially returned', draft: 'Draft',
};
const qty = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * Billing & Accounts → Gate Pass Out: what PCD has sent out of the gate,
 * read-only, with each pass's PDF. (BillingGatePassController)
 */
export default function GatePassOut({ passes, filters, customers = [], counts = {} }: any) {
    const [f, setF] = useState({ ...filters });
    const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);

    const go = (patch: Record<string, any> = {}) => {
        const next = { ...f, ...patch };
        setF(next);
        router.get('/billing/gate-pass-out', Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v != null)) as Record<string, string>,
            { preserveState: true, preserveScroll: true, replace: true });
    };
    const hasFilter = Object.values(filters).some((v) => v !== '' && v != null);
    const rows: any[] = passes.data ?? [];
    const total = Object.values(counts as Record<string, number>).reduce((a, b) => a + Number(b), 0);

    return (
        <AppLayout header="Gate Pass Out">
            <Head title="Gate Pass Out" />
            <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
                <p className="text-sm text-surface-500">
                    Gate Pass Out issued by <span className="font-semibold text-surface-700">PCD</span> — what has left the premises.
                    Read-only here; each pass prints as its PDF.
                </p>

                {/* Status chips double as the status filter. */}
                <div className="flex flex-wrap gap-2">
                    {[['', 'All', total], ['issued', 'Issued', counts.issued], ['pending_approval', 'Awaiting approval', counts.pending_approval],
                      ['completed', 'Completed', counts.completed], ['rejected', 'Rejected', counts.rejected]].map(([key, label, n]: any) => (
                        <button key={key || 'all'} type="button" onClick={() => go({ status: key })}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                (filters.status ?? '') === key ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                            {label} <span className="ml-1 tabular-nums opacity-70">{Number(n ?? 0)}</span>
                        </button>
                    ))}
                </div>

                <div className="card">
                    <div className="card-body flex flex-wrap items-end gap-3">
                        <div className="relative flex-1 min-w-[14rem]">
                            <label className="form-label !text-[11px]">Search</label>
                            <i className="fi fi-rr-search absolute left-3 bottom-[0.7rem] text-[11px] leading-none text-surface-400" />
                            <input className="form-input !py-1.5 !pl-8 text-sm w-full" placeholder="Pass no., client, item, vehicle…  (Enter)"
                                value={f.search ?? ''} onChange={(e) => setF({ ...f, search: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && go()} />
                        </div>
                        <div>
                            <label className="form-label !text-[11px]">From</label>
                            <input type="date" className="form-input !py-1.5 text-sm" value={f.date_from ?? ''} onChange={(e) => go({ date_from: e.target.value })} />
                        </div>
                        <div>
                            <label className="form-label !text-[11px]">To</label>
                            <input type="date" className="form-input !py-1.5 text-sm" value={f.date_to ?? ''} onChange={(e) => go({ date_to: e.target.value })} />
                        </div>
                        <div className="min-w-[14rem]">
                            <label className="form-label !text-[11px]">Client</label>
                            <select className="form-select !py-1.5 text-sm w-full" value={f.customer_id ?? ''} onChange={(e) => go({ customer_id: e.target.value })}>
                                <option value="">All clients</option>
                                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        {hasFilter && (
                            <button type="button" className="btn-ghost btn-sm"
                                onClick={() => go({ search: '', status: '', date_from: '', date_to: '', customer_id: '' })}>
                                <i className="fi fi-rr-cross-small text-xs leading-none" /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-body p-0 overflow-x-auto">
                        {rows.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-12 h-12 rounded-xl bg-surface-50 flex items-center justify-center mx-auto mb-3">
                                    <i className="fi fi-rr-truck-side text-surface-400 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">No Gate Pass Out</p>
                                <p className="text-xs text-surface-400 mt-1">{hasFilter ? 'Nothing matches these filters.' : 'PCD has not issued any Gate Pass Out yet.'}</p>
                            </div>
                        ) : (
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-surface-200 text-[10px] uppercase tracking-wider text-surface-400 font-bold">
                                        <th className="text-left px-4 py-2.5 w-40">Pass</th>
                                        <th className="text-left px-3 py-2.5">Client</th>
                                        <th className="text-left px-3 py-2.5">Items going out</th>
                                        <th className="text-left px-3 py-2.5 w-40">Issued / approved</th>
                                        <th className="text-right px-4 py-2.5 w-24">PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((p) => (
                                        <tr key={p.id} className="border-b border-surface-50 hover:bg-brand-50/30 transition-colors align-top">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-surface-900">{p.pass_no}</div>
                                                <div className="text-[11px] text-surface-500">{p.pass_date}</div>
                                                <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-slate'} mt-1`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                                            </td>
                                            <td className="px-3 py-3 max-w-[16rem]">
                                                <div className="font-semibold text-surface-800 line-clamp-2">{p.customer}</div>
                                                {(p.rep || p.vehicle_no) && (
                                                    <div className="text-[11px] text-surface-500 mt-0.5">
                                                        {p.rep}{p.rep && p.vehicle_no ? ' · ' : ''}{p.vehicle_no && <span>Vehicle {p.vehicle_no}</span>}
                                                    </div>
                                                )}
                                                {p.rfq_id && <div className="text-[11px] text-surface-400">RFQ #{p.rfq_id}</div>}
                                            </td>
                                            <td className="px-3 py-3">
                                                <ul className="space-y-0.5">
                                                    {p.items.slice(0, 3).map((i: any, k: number) => (
                                                        <li key={k} className="flex gap-2">
                                                            <span className="text-surface-700 truncate max-w-[22rem]">{i.description}</span>
                                                            <span className="text-surface-500 tabular-nums shrink-0">{qty(i.quantity)} {i.unit}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                {p.items.length > 3 && <div className="text-[11px] text-surface-400 mt-0.5">+{p.items.length - 3} more</div>}
                                            </td>
                                            <td className="px-3 py-3 text-[12px] text-surface-600">
                                                <div>{p.issued_by ?? '—'}</div>
                                                {p.approved_by && <div className="text-[11px] text-emerald-700">Approved · {p.approved_by}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button type="button" className="btn-outline btn-sm"
                                                    onClick={() => setPdf({ url: `/billing/gate-pass-out/${p.id}/pdf?preview=base64`, title: `Gate Pass Out ${p.pass_no}` })}>
                                                    <i className="fi fi-rr-file-pdf text-xs leading-none text-red-600" /> PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {passes.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100 text-xs text-surface-500">
                            <span>Showing {passes.from}–{passes.to} of {passes.total}</span>
                            <div className="flex items-center gap-1">
                                {passes.links.map((l: any, k: number) => (
                                    <button key={k} type="button" disabled={!l.url || l.active}
                                        onClick={() => l.url && router.get(l.url, {}, { preserveScroll: true, preserveState: true })}
                                        className={`min-w-[2rem] px-2 py-1 rounded-md border text-xs ${l.active ? 'bg-brand-600 border-brand-600 text-white' : 'border-surface-200 hover:bg-surface-50 disabled:opacity-40'}`}
                                        dangerouslySetInnerHTML={{ __html: l.label }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null} title={pdf?.title ?? 'Gate Pass Out'} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
