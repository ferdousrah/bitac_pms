import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const MODE_LABEL: Record<string, string> = {
    uploaded:    'Uploaded letterhead',
    self_issued: 'Self-issued (digital)',
};

const MODE_BADGE: Record<string, string> = {
    uploaded:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    self_issued: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function CompletionCertificatesIndex({ certificates, filters, stats }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [mode, setMode] = useState(filters?.mode ?? '');
    const [rating, setRating] = useState(filters?.rating ?? '');

    const apply = () => router.get('/ied/completion-certificates', { search, mode, rating }, { preserveState: true });
    const reset = () => { setSearch(''); setMode(''); setRating(''); router.get('/ied/completion-certificates'); };

    const rows = certificates?.data ?? [];

    return (
        <AppLayout header="Completion Certificates">
            <div className="space-y-6 animate-fade-in">

                {/* Stat tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Total"    value={stats.total}     color="indigo"  icon="fi-rr-diploma" />
                    <Stat label="Uploaded" value={stats.uploaded}  color="emerald" icon="fi-rr-cloud-upload" />
                    <Stat label="Self-Issued" value={stats.self}   color="purple"  icon="fi-rr-edit" />
                    <Stat label="Avg Rating" value={stats.avg_rating ? `${stats.avg_rating} ★` : '—'} color="amber" icon="fi-rr-star" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Customer-Issued Completion Certificates</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Formal acceptance certificates submitted by customers after delivery.</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search cert #, WO #, customer, issuer…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={mode} onChange={e => setMode(e.target.value)} className="form-select w-auto">
                            <option value="">All modes</option>
                            <option value="uploaded">Uploaded</option>
                            <option value="self_issued">Self-Issued</option>
                        </select>
                        <select value={rating} onChange={e => setRating(e.target.value)} className="form-select w-auto">
                            <option value="">All ratings</option>
                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} ★</option>)}
                        </select>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {(search || mode || rating) && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Cert #</th>
                                    <th>Work Order</th>
                                    <th>Customer</th>
                                    <th>Issued By</th>
                                    <th>Mode</th>
                                    <th className="text-center">Rating</th>
                                    <th>Issued Date</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c: any) => (
                                    <tr key={c.id}>
                                        <td>
                                            <span className="font-mono text-xs font-bold text-indigo-600">{c.certificate_number}</span>
                                        </td>
                                        <td>
                                            <Link href={`/work-orders/${c.wo_id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                                                {c.wo_number}
                                            </Link>
                                            {c.product && <div className="text-[10px] text-surface-400 mt-0.5 max-w-[180px] truncate">{c.product}</div>}
                                        </td>
                                        <td className="text-sm text-surface-700">{c.customer ?? '—'}</td>
                                        <td className="text-sm text-surface-700">{c.issued_by_name}</td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${MODE_BADGE[c.mode]}`}>
                                                {MODE_LABEL[c.mode] ?? c.mode}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            {c.rating ? (
                                                <span className="text-amber-500 text-sm font-bold whitespace-nowrap">
                                                    {'★'.repeat(c.rating)}<span className="text-surface-200">{'★'.repeat(5 - c.rating)}</span>
                                                </span>
                                            ) : <span className="text-surface-300">—</span>}
                                        </td>
                                        <td className="text-xs text-surface-500">{c.issued_date}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <a href={`/ied/completion-certificates/${c.id}/preview`} target="_blank" rel="noreferrer"
                                                   className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-eye text-[11px] leading-none" /> View
                                                </a>
                                                <a href={`/ied/completion-certificates/${c.id}/download`}
                                                   className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                                    <i className="fi fi-rr-download text-[11px] leading-none" /> Download
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-diploma" /></div>
                                                <p className="empty-state-title">No certificates yet</p>
                                                <p className="empty-state-text">Customer-issued completion certificates will appear here once delivered orders are formally acknowledged.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {certificates?.links && certificates.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                            {certificates.links.map((l: any, i: number) => (
                                <Link key={i} href={l.url ?? '#'} preserveScroll
                                    className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                        l.active ? 'bg-surface-900 text-white'
                                        : l.url ? 'text-surface-700 hover:bg-surface-100'
                                        : 'text-surface-300 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: l.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function Stat({ label, value, color, icon }: any) {
    const colors: Record<string, string> = {
        indigo:  'from-indigo-50 to-indigo-100 text-indigo-600',
        emerald: 'from-emerald-50 to-emerald-100 text-emerald-600',
        purple:  'from-purple-50 to-purple-100 text-purple-600',
        amber:   'from-amber-50 to-amber-100 text-amber-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-surface-100 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
                    <div className="font-bold text-2xl text-surface-900 mt-1 font-mono leading-none">{value}</div>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shrink-0`}>
                    <i className={`fi ${icon} text-sm leading-none`} />
                </div>
            </div>
        </div>
    );
}
