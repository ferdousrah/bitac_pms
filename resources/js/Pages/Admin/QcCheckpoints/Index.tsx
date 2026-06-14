import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function QcCheckpointsIndex({ checkpoints, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const apply = () => router.get('/admin/qc-checkpoints', { search }, { preserveState: true });
    const remove = (id: number, name: string) => {
        if (!confirm(`Delete QC checkpoint "${name}"?`)) return;
        router.delete(`/admin/qc-checkpoints/${id}`);
    };

    return (
        <AppLayout header="QC Checkpoints">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">QC Checkpoints</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                {checkpoints.total ?? checkpoints.data?.length} checkpoint{(checkpoints.total ?? checkpoints.data?.length) === 1 ? '' : 's'} — drives the default checklist on every new QC inspection.
                            </p>
                        </div>
                        <Link href="/admin/qc-checkpoints/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Checkpoint
                        </Link>
                    </div>

                    <div className="card-body border-b border-surface-100 flex flex-col sm:flex-row gap-3">
                        <input type="text" value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            placeholder="Search by name or category..."
                            className="form-input flex-1" />
                        <button onClick={apply} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Filter
                        </button>
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th className="w-16 text-center">Order</th>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checkpoints.data?.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="text-center text-surface-400 font-mono text-xs">{c.display_order}</td>
                                        <td className="font-medium text-surface-900">{c.name}</td>
                                        <td>{c.category ? <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-700">{c.category}</span> : <span className="text-surface-400">—</span>}</td>
                                        <td className="text-surface-600 text-sm max-w-md truncate">{c.description ?? '—'}</td>
                                        <td>
                                            {c.is_active
                                                ? <span className="badge badge-green">Active</span>
                                                : <span className="badge badge-slate">Inactive</span>}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/qc-checkpoints/${c.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[11px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(c.id, c.name)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[11px] leading-none" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!checkpoints.data || checkpoints.data.length === 0) && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                                <p className="empty-state-title">No QC checkpoints yet</p>
                                                <p className="empty-state-text">Add your first checkpoint to seed the inspection checklist.</p>
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
