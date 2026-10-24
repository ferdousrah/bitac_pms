import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = { delivered: 'badge-green', scheduled: 'badge-amber', cancelled: 'badge-red' };
const qty = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * Billing & Accounts → Delivery Challans: the challan copy that goes to the
 * client with the bill, read-only, as a PDF. (BillingDeliveryChallanController)
 */
export default function DeliveryChallans({ challans, filters, customers = [] }: any) {
    const [f, setF] = useState({ ...filters });
    const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);

    const go = (patch: Record<string, any> = {}) => {
        const next = { ...f, ...patch };
        setF(next);
        router.get('/billing/delivery-challans', Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v != null)) as Record<string, string>,
            { preserveState: true, preserveScroll: true, replace: true });
    };
    const hasFilter = Object.values(filters).some((v) => v !== '' && v != null);
    const rows: any[] = challans.data ?? [];

    return (
        <AppLayout header="Delivery Challans">
            <Head title="Delivery Challans" />
            <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
                <p className="text-sm text-surface-500">
                    The delivery challan of every delivery — the copy that goes to the client with the bill. Read-only here; each prints as its PDF.
                </p>

                <div className="card">
                    <div className="card-body flex flex-wrap items-end gap-3">
                        <div className="relative flex-1 min-w-[14rem]">
                            <label className="form-label !text-[11px]">Search</label>
                            <i className="fi fi-rr-search absolute left-3 bottom-[0.7rem] text-[11px] leading-none text-surface-400" />
                            <input className="form-input !py-1.5 !pl-8 text-sm w-full" placeholder="Challan no., job, client, vehicle…  (Enter)"
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
                        <div className="min-w-[13rem]">
                            <label className="form-label !text-[11px]">Client</label>
                            <select className="form-select !py-1.5 text-sm w-full" value={f.customer_id ?? ''} onChange={(e) => go({ customer_id: e.target.value })}>
                                <option value="">All clients</option>
                                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label !text-[11px]">Status</label>
                            <select className="form-select !py-1.5 text-sm" value={f.status ?? ''} onChange={(e) => go({ status: e.target.value })}>
                                <option value="">Any</option>
                                <option value="delivered">Delivered</option>
                                <option value="scheduled">Scheduled</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label !text-[11px]">Bill</label>
                            <select className="form-select !py-1.5 text-sm" value={f.billed ?? ''} onChange={(e) => go({ billed: e.target.value })}>
                                <option value="">Any</option>
                                <option value="yes">Billed</option>
                                <option value="no">Not billed yet</option>
                            </select>
                        </div>
                        {hasFilter && (
                            <button type="button" className="btn-ghost btn-sm"
                                onClick={() => go({ search: '', status: '', date_from: '', date_to: '', customer_id: '', billed: '' })}>
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
                                    <i className="fi fi-rr-document text-surface-400 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">No delivery challans</p>
                                <p className="text-xs text-surface-400 mt-1">{hasFilter ? 'Nothing matches these filters.' : 'No delivery has been raised yet.'}</p>
                            </div>
                        ) : (
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-surface-200 text-[10px] uppercase tracking-wider text-surface-400 font-bold">
                                        <th className="text-left px-4 py-2.5">Challan</th>
                                        <th className="text-left px-3 py-2.5">Job / client</th>
                                        <th className="text-center px-3 py-2.5 w-28">Quantity</th>
                                        <th className="text-left px-3 py-2.5 w-36">Bill</th>
                                        <th className="text-right px-4 py-2.5 w-24">PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((c) => (
                                        <tr key={c.id} className="border-b border-surface-50 hover:bg-brand-50/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-surface-900">{c.challan_number}</div>
                                                <div className="text-[11px] text-surface-500">{c.date}{c.vehicle_number ? ` · ${c.vehicle_number}` : ''}</div>
                                                <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-slate'} capitalize mt-1`}>{c.status}</span>
                                            </td>
                                            <td className="px-3 py-3 max-w-[20rem]">
                                                <div className="font-semibold text-surface-800">{c.job}</div>
                                                <div className="text-[11px] text-surface-500 truncate">{c.customer}</div>
                                            </td>
                                            <td className="px-3 py-3 text-center tabular-nums text-surface-700">
                                                {qty(c.quantity)} <span className="text-surface-400">of {qty(c.ordered)}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                {c.invoice
                                                    ? <Link href={`/invoices/${c.invoice.id}`} className="text-brand-600 hover:underline font-semibold">{c.invoice.number}</Link>
                                                    : <span className="text-[11px] text-rose-600 font-semibold">Not billed yet</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button type="button" className="btn-outline btn-sm"
                                                    onClick={() => setPdf({ url: `/billing/delivery-challans/${c.id}/pdf?preview=base64`, title: `Delivery Challan ${c.challan_number}` })}>
                                                    <i className="fi fi-rr-file-pdf text-xs leading-none text-red-600" /> PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {challans.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100 text-xs text-surface-500">
                            <span>Showing {challans.from}–{challans.to} of {challans.total}</span>
                            <div className="flex items-center gap-1">
                                {challans.links.map((l: any, k: number) => (
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

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null} title={pdf?.title ?? 'Delivery Challan'} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
