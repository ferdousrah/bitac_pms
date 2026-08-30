import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState, useRef, FormEvent } from 'react';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';

interface Pass {
    id: number;
    pass_no: string;
    direction: 'in' | 'out';
    rfq_id: number | null;
    customer: string | null;
    customer_rep: string | null;
    pass_date: string | null;
    item_count: number;
    status: string;
    issued_by: string | null;
    approved_by?: string | null;
    return_state?: 'none' | 'partial' | 'full';
}

interface Props {
    passes: { data: Pass[]; current_page: number; last_page: number; from: number; to: number; total: number; links: any[] };
    filters: { search: string; direction: string; status: string; date_from: string; date_to: string; customer_id: string };
    customers?: { id: number; name: string }[];
}

const DIRECTION_BADGE: Record<string, { label: string; cls: string }> = {
    in:  { label: 'Gate Pass In',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    out: { label: 'Gate Pass Out', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};
const STATUS_BADGE: Record<string, string> = {
    issued:            'badge-green',
    draft:             'badge-slate',
    pending_approval:  'badge-amber',
    rejected:          'badge-red',
    completed:         'badge-blue',
    cancelled:         'badge-red',
    partially_returned:'badge-amber',
};
const STATUS_LABEL: Record<string, string> = {
    issued: 'Issued', draft: 'Draft', pending_approval: 'Pending Approval',
    rejected: 'Rejected', completed: 'Completed', cancelled: 'Cancelled',
    partially_returned: 'Partially Returned',
};

export default function GatePassIndex({ passes, filters, customers = [], basePath = '/ied/gate-passes', lockedDirection, canApprove = false, mySignatureUrl = null }: any) {
    const [search, setSearch]     = useState(filters.search || '');
    const [direction, setDir]     = useState(filters.direction || '');
    const [status, setStatus]     = useState(filters.status || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo]     = useState(filters.date_to || '');
    const [customerId, setCustomerId] = useState(filters.customer_id || '');
    const isOutOnly = lockedDirection === 'out';

    // Approve / reject modal state (PCD approvers only).
    const [approveId, setApproveId] = useState<number | null>(null);
    const [rejectId, setRejectId]   = useState<number | null>(null);
    const [reason, setReason]       = useState('');
    const [busy, setBusy]           = useState(false);
    const sigRef = useRef<SignaturePadHandle>(null);

    const doApprove = () => {
        if (approveId == null) return;
        setBusy(true);
        router.post(`${basePath}/${approveId}/approve`, { signature: sigRef.current?.toDataURL() ?? null }, {
            preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setApproveId(null),
        });
    };
    const doReject = () => {
        if (rejectId == null || reason.trim().length < 3) return;
        setBusy(true);
        router.post(`${basePath}/${rejectId}/reject`, { rejection_reason: reason }, {
            preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => { setRejectId(null); setReason(''); },
        });
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.get(basePath, { search, direction, status, date_from: dateFrom, date_to: dateTo, customer_id: customerId },
            { preserveState: true });
    };

    const clearFilters = () => {
        setSearch(''); setDir(''); setStatus(''); setDateFrom(''); setDateTo(''); setCustomerId('');
        router.get(basePath, {}, { preserveState: true });
    };
    const hasFilters = !!(search || direction || status || dateFrom || dateTo || customerId);

    return (
        <AppLayout header={isOutOnly ? 'Gate Pass Out' : 'Gate Passes'}>
            <div className="space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{isOutOnly ? 'Gate Pass Out' : 'Gate Passes'}</h1>
                        <p className="page-subtitle">
                            {isOutOnly
                                ? `Outbound passes for sample / production items leaving the floor · ${passes.total} total`
                                : `Reference sample tracking — IN / OUT records · ${passes.total} total`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isOutOnly && (
                            <Link href={`${basePath}/create?direction=in`} className="btn-outline">
                                <i className="fi fi-rr-sign-in-alt text-xs leading-none" /> New Gate Pass In
                            </Link>
                        )}
                        <Link href={`${basePath}/create?direction=out`} className="btn-primary">
                            <i className="fi fi-rr-sign-out-alt text-xs leading-none" /> New Gate Pass Out
                        </Link>
                    </div>
                </div>

                <form onSubmit={submit} className="card">
                    <div className="card-body grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Pass No, customer rep, RFQ #…"
                            className="form-input sm:col-span-2"
                        />
                        <select value={direction} onChange={e => setDir(e.target.value)} className="form-input">
                            <option value="">All directions</option>
                            <option value="in">Gate Pass In</option>
                            <option value="out">Gate Pass Out</option>
                        </select>
                        <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
                            <option value="">All status</option>
                            <option value="pending_approval">Pending Approval</option>
                            <option value="issued">Issued</option>
                            <option value="partially_returned">Partially Returned</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        {/* Company */}
                        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="form-input sm:col-span-2">
                            <option value="">All companies</option>
                            {(customers ?? []).map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        {/* Pass date range */}
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-surface-400 shrink-0">From</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-surface-400 shrink-0">To</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input" />
                        </div>

                        <div className="flex gap-2 sm:col-span-2">
                            <button type="submit" className="btn-primary flex-1">Search</button>
                            {hasFilters && (
                                <button type="button" onClick={clearFilters} className="btn-ghost text-red-600 hover:bg-red-50">
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                {passes.data.length === 0 ? (
                    <div className="card">
                        <div className="card-body py-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
                                <i className="fi fi-rr-shield-check text-surface-400 text-2xl" />
                            </div>
                            <div className="text-base font-bold text-surface-900">No gate passes yet</div>
                            <p className="text-xs text-surface-500 mt-1 mb-4">Issue a new pass when a customer brings or collects a reference sample.</p>
                        </div>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-36 text-left">Pass No</th>
                                        <th className="text-left">Customer / Rep</th>
                                        <th className="text-center w-20">Items</th>
                                        <th className="text-left w-28">Date</th>
                                        <th className="text-left w-28">Status</th>
                                        <th className="text-left w-32">Issued by</th>
                                        <th className="w-16 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {passes.data.map((p: any) => {
                                        const db = DIRECTION_BADGE[p.direction];
                                        return (
                                            <tr key={p.id} className="group">
                                                <td>
                                                    <Link href={`${basePath}/${p.id}`} className="block">
                                                        <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">{p.pass_no}</span>
                                                        <div className="mt-0.5">
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${db.cls}`}>
                                                                {db.label}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td>
                                                    <div className="text-sm font-semibold text-surface-900">{p.customer ?? '—'}</div>
                                                    <div className="text-xs text-surface-500">{p.customer_rep ?? '—'}</div>
                                                    {p.rfq_id && <div className="text-[10px] text-surface-400 font-mono mt-0.5">RFQ #{p.rfq_id}</div>}
                                                </td>
                                                <td className="text-center font-mono font-semibold">{p.item_count}</td>
                                                <td className="text-xs text-surface-700">{p.pass_date}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-slate'}`}>
                                                        {STATUS_LABEL[p.status] ?? p.status}
                                                    </span>
                                                    {p.status === 'issued' && p.approved_by && (
                                                        <div className="text-[10px] text-surface-400 mt-0.5">by {p.approved_by}</div>
                                                    )}
                                                </td>
                                                <td className="text-xs text-surface-500">{p.issued_by ?? '—'}</td>
                                                <td className="text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        {canApprove && p.status === 'pending_approval' && (
                                                            <>
                                                                <button type="button" onClick={() => setApproveId(p.id)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700" title="Approve">
                                                                    <i className="fi fi-rr-check text-xs leading-none" />
                                                                </button>
                                                                <button type="button" onClick={() => { setRejectId(p.id); setReason(''); }}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700" title="Reject">
                                                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <Link
                                                            href={`${basePath}/${p.id}`}
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-50 hover:bg-brand-50 hover:text-brand-700 text-surface-500 transition-colors"
                                                            title="View"
                                                        >
                                                            <i className="fi fi-rr-eye text-xs leading-none" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Approve modal — signature required */}
            {approveId != null && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setApproveId(null)}>
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i className="fi fi-rr-check" /></div>
                            <h3 className="text-base font-bold text-surface-900">Approve Gate Pass</h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-surface-600">Any one approver finalises the pass (→ issued).</p>
                            {mySignatureUrl && (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2">
                                    <div className="text-[11px] font-semibold text-emerald-700 mb-1">Your saved signature (used by default)</div>
                                    <img src={mySignatureUrl} alt="saved signature" className="h-12 object-contain" />
                                </div>
                            )}
                            <div>
                                <label className="form-label">{mySignatureUrl ? 'Draw to override (optional)' : 'Signature'}</label>
                                <SignaturePad ref={sigRef} />
                            </div>
                        </div>
                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex justify-end gap-2 rounded-b-2xl">
                            <button type="button" onClick={() => setApproveId(null)} disabled={busy} className="btn-outline">Cancel</button>
                            <button type="button" onClick={doApprove} disabled={busy} className="btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-600">
                                {busy ? 'Approving…' : 'Approve & Issue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal — reason required */}
            {rejectId != null && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && setRejectId(null)}>
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><i className="fi fi-rr-cross-circle" /></div>
                            <h3 className="text-base font-bold text-surface-900">Reject Gate Pass</h3>
                        </div>
                        <div className="p-5 space-y-2">
                            <label className="form-label">Reason <span className="text-red-500">*</span></label>
                            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="form-input" style={{ resize: 'vertical' }} placeholder="Why is this pass rejected?" />
                            <p className="form-hint">Minimum 3 characters.</p>
                        </div>
                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex justify-end gap-2 rounded-b-2xl">
                            <button type="button" onClick={() => setRejectId(null)} disabled={busy} className="btn-outline">Cancel</button>
                            <button type="button" onClick={doReject} disabled={busy || reason.trim().length < 3} className="btn bg-rose-600 hover:bg-rose-700 text-white">
                                {busy ? 'Rejecting…' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
