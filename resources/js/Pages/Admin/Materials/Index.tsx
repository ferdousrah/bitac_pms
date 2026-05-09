import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

const fmt = (v: any) => `৳${Number(v ?? 0).toLocaleString('en-IN')}`;

export default function MaterialsIndex({ materials, filters, categories }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [category, setCategory] = useState(filters?.category ?? '');

    const apply = () => router.get('/admin/materials', { search, category }, { preserveState: true });
    const remove = (id: number, name: string) => {
        if (!confirm(`Delete material "${name}"?`)) return;
        router.delete(`/admin/materials/${id}`);
    };

    return (
        <AppLayout header="Materials Master">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Material Catalog</h2>
                            <p className="text-xs text-surface-400 mt-0.5">{materials.total ?? materials.data?.length} materials with rates &amp; densities</p>
                        </div>
                        <Link href="/admin/materials/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Material
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-3">
                        <input type="text" value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            placeholder="Search materials..."
                            className="form-input flex-1" />
                        <select value={category}
                            onChange={e => { setCategory(e.target.value); router.get('/admin/materials', { search, category: e.target.value }, { preserveState: true }); }}
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
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th className="text-right">Rate (৳/Kg)</th>
                                    <th className="text-right">Density (kg/m³)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materials.data.map((m: any) => (
                                    <tr key={m.id}>
                                        <td className="font-semibold text-surface-900">{m.name}</td>
                                        <td>
                                            {m.category && (
                                                <span className="badge badge-slate capitalize">{m.category.replace(/_/g, ' ')}</span>
                                            )}
                                        </td>
                                        <td className="text-right font-mono text-sm">{fmt(m.rate_per_kg)}</td>
                                        <td className="text-right font-mono text-sm text-surface-600">{m.density_kg_m3 ?? '—'}</td>
                                        <td>
                                            <span className={`badge ${m.is_active ? 'badge-green' : 'badge-slate'}`}>
                                                {m.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <Link href={`/admin/materials/${m.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-xs leading-none" />
                                                </Link>
                                                <button onClick={() => remove(m.id, m.name)} className="btn-ghost btn-xs text-red-600 hover:bg-red-50">
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
