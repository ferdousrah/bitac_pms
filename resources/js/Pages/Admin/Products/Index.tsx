import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function ProductsIndex({ products, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const apply = () => router.get('/admin/products', { search }, { preserveState: true });
    const remove = (id: number, name: string) => {
        if (!confirm(`Delete product "${name}"?`)) return;
        router.delete(`/admin/products/${id}`);
    };

    return (
        <AppLayout header="Products">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Products</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {products.total ?? products.data?.length} product{(products.total ?? products.data?.length) === 1 ? '' : 's'} — drives the "Product Type" dropdown on RFQ items.
                            </p>
                        </div>
                        <Link href="/admin/products/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Product
                        </Link>
                    </div>

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

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Unit</th>
                                    <th>Description</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.data?.map((p: any) => (
                                    <tr key={p.id}>
                                        <td className="font-medium text-surface-900">{p.name}</td>
                                        <td>{p.code ? <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-700">{p.code}</span> : <span className="text-surface-400">—</span>}</td>
                                        <td className="text-surface-600 text-sm">{p.unit ?? '—'}</td>
                                        <td className="text-surface-600 text-sm max-w-md truncate">{p.description ?? '—'}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/products/${p.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[11px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(p.id, p.name)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[11px] leading-none" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!products.data || products.data.length === 0) && (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-box" /></div>
                                                <p className="empty-state-title">No products yet</p>
                                                <p className="empty-state-text">Add your first product to populate the RFQ Product Type dropdown.</p>
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
