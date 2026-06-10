import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const CATEGORY_BADGE: Record<string, string> = {
    govt_ministry:     'bg-blue-50 text-blue-700 border-blue-200',
    industry_customer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    academic:          'bg-purple-50 text-purple-700 border-purple-200',
    industry_body:     'bg-amber-50 text-amber-700 border-amber-200',
    internal:          'bg-slate-50 text-slate-600 border-slate-200',
    other:             'bg-rose-50 text-rose-700 border-rose-200',
};

export default function StakeholdersIndex({ stakeholders, filters, categories, stats }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [category, setCategory] = useState(filters?.category ?? '');
    const [showImport, setShowImport] = useState(false);

    const apply = () => router.get('/ied/stakeholders', { search, category }, { preserveState: true });
    const reset = () => { setSearch(''); setCategory(''); router.get('/ied/stakeholders'); };

    const remove = (id: number, name: string) => {
        if (!confirm(`Remove "${name}" from directory?`)) return;
        router.delete(`/ied/stakeholders/${id}`);
    };

    const rows = stakeholders?.data ?? [];

    return (
        <AppLayout header="Stakeholder Directory">
            <div className="space-y-6 animate-fade-in">

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Stakeholder Directory</h2>
                            <p className="text-xs text-surface-400 mt-0.5">{stats.total} stakeholders · {stats.active} active</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/ied/stakeholder-forms" className="btn-outline btn-sm">
                                <i className="fi fi-rr-form text-xs leading-none" /> Forms
                            </Link>
                            <button onClick={() => setShowImport(true)} className="btn-outline btn-sm">
                                <i className="fi fi-rr-upload text-xs leading-none" /> Bulk Import
                            </button>
                            <Link href="/ied/stakeholders/create" className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add
                            </Link>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search name, email, organisation…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="form-select w-auto">
                            <option value="">All categories</option>
                            {Object.entries(categories).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Apply
                        </button>
                        {(search || category) && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Organisation</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((s: any) => (
                                    <tr key={s.id}>
                                        <td className="font-medium text-surface-900">
                                            {s.name}
                                            {s.designation && <div className="text-[10px] text-surface-400 mt-0.5">{s.designation}</div>}
                                        </td>
                                        <td className="text-xs text-surface-600">
                                            <a href={`mailto:${s.email}`} className="text-brand-600 hover:underline">{s.email}</a>
                                            {s.phone && <div className="text-[10px] text-surface-400 mt-0.5">{s.phone}</div>}
                                        </td>
                                        <td className="text-sm text-surface-700">{s.organization ?? '—'}</td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${CATEGORY_BADGE[s.category]}`}>
                                                {s.category_label}
                                            </span>
                                        </td>
                                        <td>
                                            {s.is_active
                                                ? <span className="badge badge-green">Active</span>
                                                : <span className="badge badge-slate">Inactive</span>}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/ied/stakeholders/${s.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[10px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(s.id, s.name)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[10px] leading-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={6}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon"><i className="fi fi-rr-users" /></div>
                                            <p className="empty-state-title">No stakeholders yet</p>
                                            <p className="empty-state-text">Add stakeholders one by one or bulk-import from CSV.</p>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showImport && <ImportModal onClose={() => setShowImport(false)} />}
        </AppLayout>
    );
}

function ImportModal({ onClose }: any) {
    const [file, setFile] = useState<File | null>(null);

    const submit = (e: any) => {
        e.preventDefault();
        if (!file) return;
        const fd = new FormData();
        fd.append('csv', file);
        router.post('/ied/stakeholders/import', fd as any, { onSuccess: onClose });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in origin-top" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-surface-900">Bulk Import Stakeholders</h3>
                    <button onClick={onClose} className="btn-ghost btn-icon"><i className="fi fi-rr-cross-small text-sm leading-none" /></button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                        <p className="font-bold mb-1">CSV columns expected:</p>
                        <p className="font-mono text-[11px]">name, email, phone, organization, designation, category</p>
                        <p className="mt-1.5 text-[11px]"><strong>name</strong> and <strong>email</strong> are required. Duplicates skipped.</p>
                    </div>
                    <input type="file" accept=".csv,.txt"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm" required />
                    <div className="flex items-center gap-2">
                        <button type="submit" disabled={!file} className="btn-primary btn-sm">Upload &amp; Import</button>
                        <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
