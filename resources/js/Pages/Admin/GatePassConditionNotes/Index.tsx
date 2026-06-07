import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function GatePassConditionNotesIndex({ notes, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');

    const apply = () => router.get('/admin/gate-pass-condition-notes', { search }, { preserveState: true });
    const reset = () => {
        setSearch('');
        router.get('/admin/gate-pass-condition-notes', {}, { preserveState: true });
    };

    const remove = (id: number, label: string) => {
        if (!confirm(`Delete condition note "${label}"?`)) return;
        router.delete(`/admin/gate-pass-condition-notes/${id}`);
    };

    return (
        <AppLayout header="Gate Pass — Condition Notes">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Condition Notes</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Preset labels shown in the gate-pass create form (e.g. "Re-machined", "For Inspection").
                            </p>
                        </div>
                        <Link href="/admin/gate-pass-condition-notes/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Note
                        </Link>
                    </div>

                    {/* Filter */}
                    <div className="card-body border-b border-surface-100 flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search label…"
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

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th className="w-16 text-center">Order</th>
                                    <th>Label</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notes.data?.map((n: any) => (
                                    <tr key={n.id}>
                                        <td className="text-center text-surface-400 font-mono text-xs">{n.display_order}</td>
                                        <td className="font-medium text-surface-900">{n.label}</td>
                                        <td>
                                            {n.is_active
                                                ? <span className="badge badge-green">Active</span>
                                                : <span className="badge badge-slate">Inactive</span>}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/admin/gate-pass-condition-notes/${n.id}/edit`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-pencil text-[11px] leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => remove(n.id, n.label)} className="btn-ghost btn-xs text-red-600 hover:text-red-700">
                                                    <i className="fi fi-rr-trash text-[11px] leading-none" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!notes.data || notes.data.length === 0) && (
                                    <tr>
                                        <td colSpan={4}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-shield" /></div>
                                                <p className="empty-state-title">No condition notes</p>
                                                <p className="empty-state-text">Add presets like "Re-machined" or "For Inspection".</p>
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
