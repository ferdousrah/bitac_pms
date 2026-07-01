import AppLayout from '@/Layouts/AppLayout';
import { router, useForm } from '@inertiajs/react';

interface Approver { id: number; user: { id: number; name: string; email: string } | null; added: string | null; }
interface Candidate { id: number; name: string; email: string; }

export default function GatePassApprovers({ approvers, candidates }: { approvers: Approver[]; candidates: Candidate[] }) {
    const { data, setData, post, processing, reset } = useForm({ user_id: '' });

    const add = () => {
        if (!data.user_id) return;
        post('/admin/gate-pass-approvers', { preserveScroll: true, onSuccess: () => reset('user_id') });
    };

    const remove = (id: number) => {
        if (!confirm('Remove this approver?')) return;
        router.delete(`/admin/gate-pass-approvers/${id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="Gate Pass Approvers">
            <div className="max-w-3xl space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">Gate Pass Approvers</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Anyone here can approve a PCD gate pass — <b>any one</b> approval finalises it. IED gate passes don't need approval.
                        </p>
                    </div>
                    <div className="card-body space-y-4">
                        {/* Add approver */}
                        <div className="flex items-end gap-2">
                            <div className="form-group flex-1 mb-0">
                                <label className="form-label">Add an approver</label>
                                <select value={data.user_id} onChange={e => setData('user_id', e.target.value)} className="form-select">
                                    <option value="">Select a user…</option>
                                    {candidates.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="button" onClick={add} disabled={processing || !data.user_id} className="btn-primary">
                                <i className="fi fi-rr-plus text-xs" /> Add
                            </button>
                        </div>

                        {/* Current approvers */}
                        {approvers.length === 0 ? (
                            <div className="empty-state py-8">
                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                <div className="empty-state-title">No approvers yet</div>
                                <div className="empty-state-text">Add at least one — PCD gate passes stay pending until an approver acts.</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100 border border-surface-100 rounded-xl">
                                {approvers.map(a => (
                                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                                            {a.user?.name?.charAt(0) ?? '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-surface-900">{a.user?.name}</div>
                                            <div className="text-[11px] text-surface-500">{a.user?.email} · added {a.added}</div>
                                        </div>
                                        <button type="button" onClick={() => remove(a.id)} className="btn-ghost btn-sm text-rose-600">
                                            <i className="fi fi-rr-trash text-xs" /> Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
