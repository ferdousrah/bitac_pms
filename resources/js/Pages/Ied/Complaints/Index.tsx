import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    open:      'badge-amber',
    in_review: 'badge-blue',
    resolved:  'badge-green',
    closed:    'badge-slate',
};

const CATEGORY_LABEL: Record<string, string> = {
    general:  'General',
    quality:  'Quality',
    delivery: 'Delivery',
    billing:  'Billing',
    other:    'Other',
};

const CATEGORY_BADGE: Record<string, string> = {
    quality:  'badge-rose',
    delivery: 'badge-amber',
    billing:  'badge-teal',
    general:  'badge-slate',
    other:    'badge-slate',
};

export default function IedComplaintsIndex({ complaints, stats, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');
    const [category, setCategory] = useState(filters?.category ?? '');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/ied/complaints', { search, status, category }, { preserveScroll: true, preserveState: true });
    };

    const rows = complaints?.data ?? [];

    return (
        <AppLayout header="Customer Feedback">
            <div className="space-y-6 animate-fade-in">
                {/* Stat tiles */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatTile label="Open"      value={stats.open}      color="amber"   icon="fi-rr-comment-alt" />
                    <StatTile label="In Review" value={stats.in_review} color="blue"    icon="fi-rr-time-check" />
                    <StatTile label="Resolved"  value={stats.resolved}  color="green"   icon="fi-rr-comment-check" />
                    <StatTile label="Closed"    value={stats.closed}    color="slate"   icon="fi-rr-archive" />
                    <StatTile label="Total"     value={stats.total}     color="indigo"  icon="fi-rr-clipboard-list" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Feedback Inbox</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Customer-filed feedback awaiting IED response</p>
                        </div>
                        <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
                            <input
                                type="text" value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="form-input form-input-sm w-48"
                                placeholder="Search ref / subject / customer"
                            />
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select form-input-sm w-36">
                                <option value="">All Status</option>
                                <option value="open">Open</option>
                                <option value="in_review">In Review</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-select form-input-sm w-36">
                                <option value="">All Categories</option>
                                <option value="general">General</option>
                                <option value="quality">Quality</option>
                                <option value="delivery">Delivery</option>
                                <option value="billing">Billing</option>
                                <option value="other">Other</option>
                            </select>
                            <button type="submit" className="btn-primary btn-sm">
                                <i className="fi fi-rr-search text-xs" /> Search
                            </button>
                        </form>
                    </div>

                    <div className="card-body p-0">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-comment-alt" /></div>
                                <p className="empty-state-title">No submissions found</p>
                                <p className="empty-state-text">When customers submit feedback or compliments they'll show up here.</p>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Ref. No</th>
                                        <th>Subject</th>
                                        <th>Customer</th>
                                        <th>Related Job</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Filed</th>
                                        <th>Responded</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((c: any) => (
                                        <tr
                                            key={c.id}
                                            className="group cursor-pointer hover:bg-surface-50"
                                            onClick={() => router.visit(`/ied/complaints/${c.id}`)}
                                        >
                                            <td>
                                                <Link href={`/ied/complaints/${c.id}`} className="font-mono font-semibold text-rose-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                    {c.reference_number}
                                                </Link>
                                            </td>
                                            <td className="text-surface-800 font-medium max-w-xs truncate">{c.subject}</td>
                                            <td className="text-sm text-surface-700">{c.customer?.name ?? '—'}</td>
                                            <td>
                                                {c.work_order ? (
                                                    <div>
                                                        <div className="font-bold text-surface-900 text-sm">Job #{c.work_order.job_number ?? '—'}</div>
                                                        <div className="text-[11px] text-surface-400 font-mono mt-0.5">{c.work_order.wo_number}</div>
                                                    </div>
                                                ) : <span className="text-surface-300">—</span>}
                                            </td>
                                            <td>
                                                <span className={`badge ${CATEGORY_BADGE[c.category] ?? 'badge-slate'} text-[10px]`}>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-slate'}`}>{String(c.status).replace(/_/g, ' ')}</span>
                                            </td>
                                            <td className="text-xs text-surface-500">{c.created_at}</td>
                                            <td className="text-xs text-surface-500">
                                                {c.responded_at ? (
                                                    <div>
                                                        <div>{c.responded_at}</div>
                                                        {c.responded_by && <div className="text-[10px] text-surface-400">by {c.responded_by}</div>}
                                                    </div>
                                                ) : <span className="text-surface-300">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function StatTile({ label, value, icon, color }: any) {
    const colors: Record<string, string> = {
        amber:  'bg-amber-50 text-amber-600',
        blue:   'bg-blue-50 text-blue-600',
        green:  'bg-emerald-50 text-emerald-600',
        slate:  'bg-surface-100 text-surface-600',
        indigo: 'bg-indigo-50 text-indigo-600',
    };
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
                <i className={`fi ${icon} text-base leading-none`} />
            </div>
            <div>
                <div className="text-2xl font-bold text-surface-900 leading-none">{value}</div>
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
        </div>
    );
}
