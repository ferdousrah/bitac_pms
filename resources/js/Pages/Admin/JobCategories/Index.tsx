import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function JobCategoriesIndex({ categories, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const apply = () => router.get('/admin/job-categories', { search }, { preserveState: true });
    const remove = (id: number, name: string) => {
        if (!confirm(`Delete job category "${name}"?\n\nIf this category is in use by any RFQ/Quotation/Work Order it will be deactivated instead of deleted.`)) return;
        router.delete(`/admin/job-categories/${id}`);
    };

    return (
        <AppLayout header="Job Categories">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Job Categories</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {categories.total ?? categories.data?.length} categor{(categories.total ?? categories.data?.length) === 1 ? 'y' : 'ies'} — used to classify RFQs, quotations and work orders.
                            </p>
                        </div>
                        <Link href="/admin/job-categories/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Category
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-3">
                        <input type="text" value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            placeholder="Search by name or code..."
                            className="form-input flex-1" />
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Filter
                        </button>
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
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.data?.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="text-center text-surface-400 font-mono text-xs">{c.display_order}</td>
                                        <td className="font-medium text-surface-900">{c.name}</td>
                                        <td>{c.code ? <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-700">{c.code}</span> : <span className="text-surface-400">—</span>}</td>
                                        <td className="text-surface-600 text-sm max-w-md truncate">{c.description ?? '—'}</td>
                                        <td>
                                            {c.is_active
                                                ? <span className="badge badge-green">Active</span>
                                                : <span className="badge badge-slate">Inactive</span>}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/job-categories/${c.id}/edit`} className="btn-ghost btn-xs">
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
                                        <td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-tags" /></div>
                                                <p className="empty-state-title">No job categories yet</p>
                                                <p className="empty-state-text">Create your first category to start classifying jobs.</p>
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
