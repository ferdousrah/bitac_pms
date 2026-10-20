import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

/** Written out in full — Tailwind does not ship a class built from a variable. */
export const QR_STATUS_BADGE: Record<string, string> = {
    new:       'bg-brand-50 text-brand-700 border-brand-200',
    in_review: 'bg-amber-50 text-amber-700 border-amber-200',
    converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed:    'bg-slate-50 text-slate-600 border-slate-200',
    spam:      'bg-rose-50 text-rose-700 border-rose-200',
};

interface Row {
    id: number; reference_no: string; name: string; organisation: string | null; email: string; phone: string;
    subject: string; quantity: number | null; unit: string | null; office: string | null; files_count: number;
    status: string; status_label: string; rfq_id: number | null; created_at: string; age: string;
}

export default function QuotationRequestsIndex({ requests, filters, stats, statuses, offices }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');
    const [office, setOffice] = useState(filters?.office ?? '');

    const go = (over: Record<string, string> = {}) =>
        router.get('/ied/quotation-requests', { search, status, office, ...over }, { preserveState: true, replace: true });
    const reset = () => { setSearch(''); setStatus(''); setOffice(''); router.get('/ied/quotation-requests'); };

    const rows: Row[] = requests?.data ?? [];
    const filtered = !!(filters?.search || filters?.status || filters?.office);

    return (
        <AppLayout header="Quote Requests">
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat label="New"        value={stats.new}       tone="brand"   icon="fi-rr-inbox-in"     onClick={() => { setStatus('new'); go({ status: 'new' }); }} />
                    <Stat label="In review"  value={stats.in_review} tone="amber"   icon="fi-rr-eye"          onClick={() => { setStatus('in_review'); go({ status: 'in_review' }); }} />
                    <Stat label="Converted"  value={stats.converted} tone="emerald" icon="fi-rr-check-circle" onClick={() => { setStatus('converted'); go({ status: 'converted' }); }} />
                    <Stat label="Closed / spam" value={stats.closed} tone="slate"   icon="fi-rr-ban" />
                    <Stat label="Total"      value={stats.total}     tone="indigo"  icon="fi-rr-paper-plane" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Quotation requests from the website</h2>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Sent from <a href="/portfolio/request-quotation" target="_blank" rel="noopener" className="font-mono text-brand-600 hover:underline">/portfolio/request-quotation</a>.
                                Open one to read it, then convert it into a draft RFQ for the customer.
                            </p>
                        </div>
                    </div>

                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && go()}
                                placeholder="Search reference, name, organisation, phone, email, job…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={status} onChange={(e) => { setStatus(e.target.value); go({ status: e.target.value }); }} className="form-select w-auto">
                            <option value="">All statuses</option>
                            {Object.entries(statuses as Record<string, string>).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={office} onChange={(e) => { setOffice(e.target.value); go({ office: e.target.value }); }} className="form-select w-auto">
                            <option value="">All centres</option>
                            {offices.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        <button onClick={() => go()} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {filtered && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Reference</th>
                                    <th>From</th>
                                    <th>Job</th>
                                    <th>Centre</th>
                                    <th>Status</th>
                                    <th>Received</th>
                                    <th className="text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className={r.status === 'new' ? 'bg-brand-50/40' : ''}>
                                        <td>
                                            <Link href={`/ied/quotation-requests/${r.id}`} className="font-mono text-xs font-bold text-brand-600 hover:underline whitespace-nowrap">
                                                {r.reference_no}
                                            </Link>
                                            {r.rfq_id && (
                                                <Link href={`/rfqs/${r.rfq_id}`} className="block text-[10px] text-emerald-700 hover:underline mt-0.5">RFQ #{r.rfq_id}</Link>
                                            )}
                                        </td>
                                        <td>
                                            <div className={`text-sm text-surface-900 ${r.status === 'new' ? 'font-bold' : 'font-medium'}`}>{r.name}</div>
                                            <div className="text-[11px] text-surface-500 mt-0.5">{r.organisation || r.phone}</div>
                                        </td>
                                        <td className="max-w-[300px]">
                                            <div className="text-sm text-surface-800 truncate">{r.subject}</div>
                                            <div className="text-[11px] text-surface-500 mt-0.5 flex items-center gap-3">
                                                {r.quantity != null && <span>{r.quantity} {r.unit}</span>}
                                                {r.files_count > 0 && (
                                                    <span className="inline-flex items-center gap-1"><i className="fi fi-rr-file text-[10px] leading-none" />{r.files_count} file{r.files_count > 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-xs text-surface-600">{r.office ?? '—'}</td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${QR_STATUS_BADGE[r.status] ?? QR_STATUS_BADGE.closed}`}>
                                                {r.status_label}
                                            </span>
                                        </td>
                                        <td className="text-xs text-surface-500 whitespace-nowrap" title={r.created_at}>{r.age}</td>
                                        <td className="text-right">
                                            <Link href={`/ied/quotation-requests/${r.id}`} className="btn-ghost btn-xs">
                                                Open <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-inbox-in" /></div>
                                                <p className="empty-state-title">{filtered ? 'Nothing matches these filters' : 'No requests yet'}</p>
                                                <p className="empty-state-text">
                                                    {filtered ? 'Clear the filters to see every request.' : 'Requests sent from the website’s “Request a quotation” form will appear here.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {requests?.links && requests.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs text-surface-500">Page {requests.current_page} of {requests.last_page} · {requests.total} requests</span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {requests.links.map((l: any, i: number) => (
                                    <Link key={i} href={l.url ?? '#'} preserveScroll
                                        className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                            l.active ? 'bg-surface-900 text-white'
                                            : l.url ? 'text-surface-700 hover:bg-surface-100'
                                            : 'text-surface-300 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: l.label }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function Stat({ label, value, tone, icon, onClick }: { label: string; value: number; tone: string; icon: string; onClick?: () => void }) {
    const tones: Record<string, string> = {
        brand:   'bg-brand-50 text-brand-600',
        amber:   'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate:   'bg-slate-100 text-slate-600',
        indigo:  'bg-indigo-50 text-indigo-600',
    };
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag onClick={onClick} className={`text-left bg-white rounded-2xl border border-surface-100 p-4 ${onClick ? 'hover:border-surface-300 transition-colors' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
                    <div className="font-bold text-2xl text-surface-900 mt-1 font-mono leading-none">{value}</div>
                </div>
                <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center shrink-0`}>
                    <i className={`fi ${icon} text-sm leading-none`} />
                </div>
            </div>
        </Tag>
    );
}
