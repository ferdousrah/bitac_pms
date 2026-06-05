import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function OperatorsIndex({ operators, sections = [], filters }: any) {
    const [search, setSearch]       = useState(filters?.search ?? '');
    const [sectionId, setSectionId] = useState(filters?.section_id ?? '');
    const [status, setStatus]       = useState(filters?.status ?? '');

    const apply = (override: any = {}) => router.get('/admin/operators',
        { search, section_id: sectionId, status, ...override },
        { preserveState: true, replace: true });

    const reset = () => {
        setSearch(''); setSectionId(''); setStatus('');
        router.get('/admin/operators', {}, { preserveState: true, replace: true });
    };

    const remove = (id: number, name: string) => {
        if (!confirm(`Delete operator "${name}"?`)) return;
        router.delete(`/admin/operators/${id}`);
    };

    const rows = operators?.data ?? operators ?? [];
    const hasFilters = !!(search || sectionId || status);

    return (
        <AppLayout header="Operators">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Shop Operators</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {operators?.total ?? rows.length} operator{(operators?.total ?? rows.length) !== 1 && 's'}{hasFilters && ' matching filters'} registered
                            </p>
                        </div>
                        <Link href="/admin/operators/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-user-add text-xs leading-none" />
                            New Operator
                        </Link>
                    </div>

                    {/* Filter toolbar */}
                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative flex-1 min-w-0">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search by employee ID, name or phone…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={sectionId}
                            onChange={e => { setSectionId(e.target.value); apply({ section_id: e.target.value }); }}
                            className="form-select sm:w-48">
                            <option value="">All sections</option>
                            {sections.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
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
                        {rows.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Employee ID</th>
                                        <th>Name</th>
                                        <th>Section</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th>Joined</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((o: any) => (
                                        <tr key={o.id}>
                                            <td className="font-mono text-xs text-surface-700">{o.employee_id}</td>
                                            <td>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {o.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-surface-900">{o.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-surface-600">{o.section?.name ?? '—'}</td>
                                            <td className="text-surface-600">{o.phone ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${o.is_active ? 'badge-green' : 'badge-slate'}`}>
                                                    {o.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-surface-500 text-xs">{o.joined_on ?? '—'}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/admin/operators/${o.id}/edit`} className="btn-outline btn-xs">
                                                        <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                                    </Link>
                                                    <button onClick={() => remove(o.id, o.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50">
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
                                <div className="empty-state-icon"><i className="fi fi-rr-users" /></div>
                                <div className="empty-state-title">No operators yet</div>
                                <div className="empty-state-text">Add operators so they can be assigned to machines.</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="card-body lg:hidden space-y-3">
                        {rows.map((o: any) => (
                            <div key={o.id} className="rounded-xl border border-surface-100 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                        {o.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-surface-900 truncate">{o.name}</div>
                                        <div className="text-xs text-surface-500 font-mono">{o.employee_id}</div>
                                    </div>
                                    <span className={`badge ${o.is_active ? 'badge-green' : 'badge-slate'}`}>
                                        {o.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <span><i className="fi fi-rr-building" /> {o.section?.name ?? '—'}</span>
                                    <span><i className="fi fi-rr-phone-call" /> {o.phone ?? '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
                                    <Link href={`/admin/operators/${o.id}/edit`} className="btn-outline btn-xs flex-1 justify-center">
                                        <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                    </Link>
                                    <button onClick={() => remove(o.id, o.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50">
                                        <i className="fi fi-rr-trash text-xs leading-none" />
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
