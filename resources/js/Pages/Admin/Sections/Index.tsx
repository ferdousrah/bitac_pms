import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const TYPE_BADGE: Record<string, string> = {
    functional:      'badge-blue',
    production_shop: 'badge-amber',
};

const TYPE_LABEL: Record<string, string> = {
    functional:      'Functional',
    production_shop: 'Production Shop',
};

export default function SectionsIndex({ sections, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [type,   setType]   = useState(filters?.type   ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');

    const apply = (override: any = {}) => router.get('/admin/sections',
        { search, type, status, ...override },
        { preserveState: true, replace: true });

    const reset = () => {
        setSearch(''); setType(''); setStatus('');
        router.get('/admin/sections', {}, { preserveState: true, replace: true });
    };

    const remove = (id: number, name: string) => {
        if (!confirm(`Delete section "${name}"?`)) return;
        router.delete(`/admin/sections/${id}`);
    };

    const hasFilters = !!(search || type || status);

    return (
        <AppLayout header="Sections / Departments">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Departments & Production Shops</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {sections.length} section{sections.length !== 1 && 's'}{hasFilters && ' matching filters'} — IED, PCD, Shops, QC
                            </p>
                        </div>
                        <Link href="/admin/sections/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" />
                            New Section
                        </Link>
                    </div>

                    {/* Filter toolbar */}
                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative flex-1 min-w-0">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search by code, name or Bengali name…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={type}
                            onChange={e => { setType(e.target.value); apply({ type: e.target.value }); }}
                            className="form-select sm:w-44">
                            <option value="">All types</option>
                            <option value="functional">Functional</option>
                            <option value="production_shop">Production Shop</option>
                        </select>
                        <select value={status}
                            onChange={e => { setStatus(e.target.value); apply({ status: e.target.value }); }}
                            className="form-select sm:w-36">
                            <option value="">All status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <button onClick={() => apply()} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {hasFilters && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    {/* Desktop table */}
                    <div className="card-body hidden lg:block overflow-x-auto p-0">
                        {sections.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Bengali</th>
                                        <th>Type</th>
                                        <th>Machines</th>
                                        <th>Operators</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map((s: any) => (
                                        <tr key={s.id} className={s.is_sub ? 'bg-surface-50/50' : ''}>
                                            <td className="text-surface-400 font-mono">{s.display_order}</td>
                                            <td>
                                                <span className={`font-mono font-semibold text-xs px-2 py-0.5 rounded ${s.is_sub ? 'text-violet-700 bg-violet-50' : 'text-surface-700 bg-surface-100'}`}>
                                                    {s.code}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-1.5">
                                                    {s.is_sub && <i className="fi fi-rr-corner-down-right text-surface-300 text-[11px] leading-none ml-3" />}
                                                    <span className={s.is_sub ? 'text-surface-700' : 'font-semibold text-surface-900'}>{s.name}</span>
                                                    {!s.is_sub && s.children_count > 0 && (
                                                        <span className="badge badge-slate text-[9px]">{s.children_count} sub</span>
                                                    )}
                                                    {s.is_sub && s.parent_name && (
                                                        <span className="text-[10px] text-surface-400">· under {s.parent_name}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-surface-600">{s.name_bn ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${TYPE_BADGE[s.type] ?? 'badge-slate'}`}>
                                                    {TYPE_LABEL[s.type]}
                                                </span>
                                            </td>
                                            <td className="text-surface-700 text-center">{s.machines_count}</td>
                                            <td className="text-surface-700 text-center">{s.operators_count}</td>
                                            <td>
                                                <span className={`badge ${s.is_active ? 'badge-green' : 'badge-slate'}`}>
                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/admin/sections/${s.id}/edit`} className="btn-outline btn-xs">
                                                        <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                                    </Link>
                                                    <button onClick={() => remove(s.id, s.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50">
                                                        <i className="fi fi-rr-trash text-xs leading-none" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-building" /></div>
                                <div className="empty-state-title">No sections yet</div>
                                <div className="empty-state-text">Create your first section to get started.</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="card-body lg:hidden space-y-3">
                        {sections.map((s: any) => (
                            <div key={s.id} className={`rounded-xl border p-4 space-y-3 ${s.is_sub ? 'border-violet-100 bg-violet-50/30 ml-4' : 'border-surface-100'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className={`font-mono font-semibold text-xs px-2 py-0.5 rounded ${s.is_sub ? 'text-violet-700 bg-violet-50' : 'text-surface-700 bg-surface-100'}`}>
                                            {s.code}
                                        </span>
                                        <div className="font-semibold text-surface-900 text-sm mt-1">{s.name}</div>
                                        {s.is_sub && s.parent_name && <div className="text-[10px] text-surface-400">↳ under {s.parent_name}</div>}
                                        {!s.is_sub && s.children_count > 0 && <div className="text-[10px] text-surface-400">{s.children_count} sub-section{s.children_count !== 1 && 's'}</div>}
                                        {s.name_bn && <div className="text-xs text-surface-500">{s.name_bn}</div>}
                                    </div>
                                    <span className={`badge ${TYPE_BADGE[s.type] ?? 'badge-slate'}`}>
                                        {TYPE_LABEL[s.type]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-surface-500">
                                    <span><i className="fi fi-rr-settings text-xs" /> {s.machines_count} machines</span>
                                    <span><i className="fi fi-rr-users text-xs" /> {s.operators_count} operators</span>
                                    <span className={`badge ${s.is_active ? 'badge-green' : 'badge-slate'} ml-auto`}>
                                        {s.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
                                    <Link href={`/admin/sections/${s.id}/edit`} className="btn-outline btn-xs flex-1 justify-center">
                                        <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                    </Link>
                                    <button onClick={() => remove(s.id, s.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50">
                                        <i className="fi fi-rr-trash text-xs leading-none" /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
