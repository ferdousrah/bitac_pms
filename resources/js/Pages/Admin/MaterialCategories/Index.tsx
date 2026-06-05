import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function MaterialCategoriesIndex({ categories, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const apply = () => router.get('/admin/material-categories', { search }, { preserveState: true });
    const reset = () => {
        setSearch('');
        router.get('/admin/material-categories', {}, { preserveState: true });
    };

    const remove = (id: number, name: string) => {
        if (!confirm(`Delete category "${name}"?\n\nIf any material uses this category it will be deactivated instead of deleted.`)) return;
        router.delete(`/admin/material-categories/${id}`);
    };

    return (
        <AppLayout header="Material Categories">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Material Categories</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {categories.total ?? categories.data?.length} categor{(categories.total ?? categories.data?.length) === 1 ? 'y' : 'ies'} — used to group materials in cost estimates
                            </p>
                        </div>
                        <Link href="/admin/material-categories/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Category
                        </Link>
                    </div>

                    {/* Filter */}
                    <div className="card-body border-b border-surface-100 flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search name or code…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {search && (
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
                                    <th className="w-16 text-center">Order</th>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Description</th>
                                    <th className="text-center">Materials</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.data?.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="text-center text-surface-400 font-mono text-xs">{c.display_order}</td>
                                        <td className="font-medium text-surface-900">{c.name}</td>
                                        <td>
                                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-700">{c.code}</span>
                                        </td>
                                        <td className="text-surface-600 text-sm max-w-md truncate">{c.description ?? '—'}</td>
                                        <td className="text-center">
                                            <span className="font-mono text-xs text-surface-700">{c.materials_count}</span>
                                        </td>
                                        <td>
                                            {c.is_active
                                                ? <span className="badge badge-green">Active</span>
                                                : <span className="badge badge-slate">Inactive</span>}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/material-categories/${c.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[11px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(c.id, c.name)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[11px] leading-none" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!categories.data || categories.data.length === 0) && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-cube" /></div>
                                                <p className="empty-state-title">No material categories</p>
                                                <p className="empty-state-text">Add a category to start grouping materials.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
