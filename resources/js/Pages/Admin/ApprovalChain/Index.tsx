import AppLayout from '@/Layouts/AppLayout';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function ApprovalChainIndex({ chain, users }: any) {
    const [editingId, setEditingId] = useState<number | null>(null);

    const addForm = useForm({ approver_id: '', label: '' });
    const editForm = useForm({ approver_id: '', label: '' });

    function startEdit(entry: any) {
        setEditingId(entry.id);
        editForm.setData({ approver_id: String(entry.approver_id), label: entry.label ?? '' });
    }

    function submitAdd(e: React.FormEvent) {
        e.preventDefault();
        addForm.post('/admin/approval-chain', {
            onSuccess: () => addForm.reset(),
        });
    }

    function submitEdit(e: React.FormEvent, id: number) {
        e.preventDefault();
        editForm.put(`/admin/approval-chain/${id}`, {
            onSuccess: () => setEditingId(null),
        });
    }

    function remove(id: number) {
        if (!confirm('Remove this approver from the chain?')) return;
        router.delete(`/admin/approval-chain/${id}`);
    }

    function moveUp(index: number) {
        if (index === 0) return;
        const ids = chain.map((e: any) => e.id);
        [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
        router.post('/admin/approval-chain/reorder', { ids });
    }

    function moveDown(index: number) {
        if (index === chain.length - 1) return;
        const ids = chain.map((e: any) => e.id);
        [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
        router.post('/admin/approval-chain/reorder', { ids });
    }

    return (
        <AppLayout header="Quotation Approval Chain">
            <div className="max-w-3xl space-y-6 animate-fade-in">

                {/* Explanation Alert */}
                <div className="alert alert-warning">
                    <div className="flex gap-3">
                        <i className="fi fi-rr-info text-amber-600 text-lg flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-900 mb-1">How it works</p>
                            <p className="text-sm text-amber-800">
                                When a quotation is submitted, approval requests are sent to each
                                approver in order (Level 1 first). All levels must approve before the quotation is marked as
                                approved. If any level rejects, the quotation is rejected.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Current Chain */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white">
                                <i className="fi fi-rr-workflow-alt text-lg" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">Current Approval Chain</h2>
                                <p className="text-sm text-surface-500">
                                    {chain.length} level{chain.length !== 1 && 's'} configured
                                </p>
                            </div>
                        </div>
                    </div>

                    {chain.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <i className="fi fi-rr-workflow-alt text-2xl" />
                            </div>
                            <div className="empty-state-title">No approvers configured</div>
                            <div className="empty-state-text">Add at least one approver using the form below.</div>
                        </div>
                    ) : (
                        <div className="card-body space-y-2">
                            {chain.map((entry: any, index: number) => (
                                <div
                                    key={entry.id}
                                    className="rounded-xl border border-surface-200 bg-surface-50/50 p-4 transition-all hover:border-surface-300"
                                >
                                    {editingId === entry.id ? (
                                        <form onSubmit={e => submitEdit(e, entry.id)} className="flex flex-col sm:flex-row gap-3 items-end">
                                            <div className="flex-1 form-group">
                                                <label className="form-label">Approver</label>
                                                <select
                                                    value={editForm.data.approver_id}
                                                    onChange={e => editForm.setData('approver_id', e.target.value)}
                                                    className="form-select"
                                                    required
                                                >
                                                    <option value="">Select user...</option>
                                                    {users.map((u: any) => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex-1 form-group">
                                                <label className="form-label">Label</label>
                                                <input
                                                    type="text"
                                                    value={editForm.data.label}
                                                    onChange={e => editForm.setData('label', e.target.value)}
                                                    placeholder="e.g. Section Head"
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={editForm.processing}
                                                    className="btn-primary btn-sm"
                                                >
                                                    <i className="fi fi-rr-check mr-1" />
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                    className="btn-ghost btn-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            {/* Level Badge */}
                                            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-sm font-bold flex items-center justify-center shadow-sm">
                                                {entry.level}
                                            </span>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-surface-900 text-sm">{entry.approver_name}</div>
                                                <div className="text-xs text-surface-400">{entry.label || `Level ${entry.level} Approval`}</div>
                                            </div>

                                            {/* Reorder */}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => moveUp(index)}
                                                    disabled={index === 0}
                                                    className="btn-icon btn-xs btn-ghost disabled:opacity-30"
                                                    title="Move up"
                                                >
                                                    <i className="fi fi-rr-angle-small-up text-base" />
                                                </button>
                                                <button
                                                    onClick={() => moveDown(index)}
                                                    disabled={index === chain.length - 1}
                                                    className="btn-icon btn-xs btn-ghost disabled:opacity-30"
                                                    title="Move down"
                                                >
                                                    <i className="fi fi-rr-angle-small-down text-base" />
                                                </button>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEdit(entry)}
                                                    className="btn-outline btn-xs"
                                                >
                                                    <i className="fi fi-rr-pencil mr-1" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => remove(entry.id)}
                                                    className="btn-danger btn-xs"
                                                >
                                                    <i className="fi fi-rr-trash mr-1" />
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add New Approver */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                <i className="fi fi-rr-user-add text-lg" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">Add Approver</h2>
                                <p className="text-sm text-surface-500">Add a new level to the approval chain</p>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <form onSubmit={submitAdd} className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 form-group">
                                <label className="form-label">User</label>
                                <select
                                    value={addForm.data.approver_id}
                                    onChange={e => addForm.setData('approver_id', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select user...</option>
                                    {users.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                                {addForm.errors.approver_id && (
                                    <p className="form-error">{addForm.errors.approver_id}</p>
                                )}
                            </div>
                            <div className="flex-1 form-group">
                                <label className="form-label">
                                    Label <span className="form-label-optional">Optional</span>
                                </label>
                                <input
                                    type="text"
                                    value={addForm.data.label}
                                    onChange={e => addForm.setData('label', e.target.value)}
                                    placeholder="e.g. Section Head, GM"
                                    className="form-input"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={addForm.processing}
                                className="btn-primary btn-sm"
                            >
                                <i className="fi fi-rr-plus mr-1" />
                                Add Approver
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
