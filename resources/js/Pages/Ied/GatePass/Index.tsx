import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState, FormEvent } from 'react';

interface Pass {
    id: number;
    pass_no: string;
    direction: 'in' | 'out';
    rfq_id: number | null;
    customer: string | null;
    customer_rep: string | null;
    pass_date: string | null;
    item_count: number;
    status: 'draft' | 'issued' | 'cancelled';
    issued_by: string | null;
}

interface Props {
    passes: { data: Pass[]; current_page: number; last_page: number; from: number; to: number; total: number; links: any[] };
    filters: { search: string; direction: string; status: string };
}

const DIRECTION_BADGE: Record<string, { label: string; cls: string }> = {
    in:  { label: 'Gate-In',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    out: { label: 'Gate-Out', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};
const STATUS_BADGE: Record<string, string> = {
    issued:    'badge-green',
    draft:     'badge-slate',
    cancelled: 'badge-red',
};

export default function GatePassIndex({ passes, filters }: Props) {
    const [search, setSearch]     = useState(filters.search || '');
    const [direction, setDir]     = useState(filters.direction || '');
    const [status, setStatus]     = useState(filters.status || '');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.get('/ied/gate-passes', { search, direction, status }, { preserveState: true });
    };

    return (
        <AppLayout header="Gate Passes">
            <div className="space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Gate Passes</h1>
                        <p className="page-subtitle">Reference sample tracking — IN / OUT records · {passes.total} total</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/ied/gate-passes/create?direction=in" className="btn-outline">
                            <i className="fi fi-rr-sign-in-alt text-xs leading-none" /> New Gate-In
                        </Link>
                        <Link href="/ied/gate-passes/create?direction=out" className="btn-primary">
                            <i className="fi fi-rr-sign-out-alt text-xs leading-none" /> New Gate-Out
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
                            <option value="in">Gate-In only</option>
                            <option value="out">Gate-Out only</option>
                        </select>
                        <div className="flex gap-2">
                            <select value={status} onChange={e => setStatus(e.target.value)} className="form-input flex-1">
                                <option value="">All status</option>
                                <option value="issued">Issued</option>
                                <option value="draft">Draft</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <button type="submit" className="btn-primary">Search</button>
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
                                    {passes.data.map(p => {
                                        const db = DIRECTION_BADGE[p.direction];
                                        return (
                                            <tr key={p.id} className="group">
                                                <td>
                                                    <Link href={`/ied/gate-passes/${p.id}`} className="block">
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
                                                    <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-slate'} capitalize`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-surface-500">{p.issued_by ?? '—'}</td>
                                                <td className="text-right">
                                                    <Link
                                                        href={`/ied/gate-passes/${p.id}`}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-50 hover:bg-brand-50 hover:text-brand-700 text-surface-500 transition-colors"
                                                        title="View"
                                                    >
                                                        <i className="fi fi-rr-eye text-xs leading-none" />
                                                    </Link>
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
        </AppLayout>
    );
}
