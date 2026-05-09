import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const CATEGORY_BADGE: Record<string, string> = {
    machining:         'badge-blue',
    casting:           'badge-amber',
    plating:           'badge-purple',
    heat_treatment:    'badge-red',
    surface_treatment: 'badge-green',
    fabrication:       'badge-slate',
    other:             'badge-slate',
};

const fmt = (v: any) => v != null ? `৳${Number(v).toLocaleString('en-IN')}` : '—';

export default function OperationsIndex({ operations, filters, categories }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [category, setCategory] = useState(filters?.category ?? '');

    const apply = () => router.get('/admin/operations', { search, category }, { preserveState: true });
    const remove = (id: number, name: string) => {
        if (!confirm(`Delete operation "${name}"?`)) return;
        router.delete(`/admin/operations/${id}`);
    };

    return (
        <AppLayout header="Machining Operations Master">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Operation Catalog</h2>
                            <p className="text-xs text-surface-400 mt-0.5">{operations.total ?? operations.data?.length} operations with 3-tier pricing</p>
                        </div>
                        <Link href="/admin/operations/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Operation
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-3">
                        <input type="text" value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            placeholder="Search operations..."
                            className="form-input flex-1" />
                        <select value={category}
                            onChange={e => { setCategory(e.target.value); router.get('/admin/operations', { search, category: e.target.value }, { preserveState: true }); }}
                            className="form-select sm:w-48">
                            <option value="">All categories</option>
                            {categories?.map((c: string) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Filter
                        </button>
                    </div>

                    {/* Table */}
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Operation</th>
                                    <th>Category</th>
                                    <th>Unit</th>
                                    <th className="text-right">Group A</th>
                                    <th className="text-right">Group B</th>
                                    <th className="text-right">Group C</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operations.data.map((o: any) => (
                                    <tr key={o.id}>
                                        <td className="font-semibold text-surface-900">{o.name}</td>
                                        <td>
                                            <span className={`badge ${CATEGORY_BADGE[o.category] ?? 'badge-slate'} capitalize`}>
                                                {o.category.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="text-surface-600 text-sm">{o.default_unit}</td>
                                        <td className="text-right font-mono text-sm">{fmt(o.rate_group_a)}</td>
                                        <td className="text-right font-mono text-sm">{fmt(o.rate_group_b)}</td>
                                        <td className="text-right font-mono text-sm">{fmt(o.rate_group_c)}</td>
                                        <td>
                                            <span className={`badge ${o.is_active ? 'badge-green' : 'badge-slate'}`}>
                                                {o.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <Link href={`/admin/operations/${o.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-xs leading-none" />
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
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
