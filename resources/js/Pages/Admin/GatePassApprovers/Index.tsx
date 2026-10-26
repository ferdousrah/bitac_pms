import AppLayout from '@/Layouts/AppLayout';
import { router, useForm } from '@inertiajs/react';

interface Approver {
    id: number;
    user: { id: number; name: string; email: string };
    added: string | null;
    can_open: boolean;
    inactive: boolean;
}
interface Candidate { id: number; name: string; email: string; }
interface Desk { label: string; approvers: Approver[]; candidates: Candidate[]; }

// What each desk's pool is for — said once, on the card it belongs to.
const ABOUT: Record<string, { who: string; icon: string; tone: string; needs: string }> = {
    ied: {
        who: "IED's নির্বাহী প্রকৌশলী — passes raised from IED → Gate Passes.",
        icon: 'fi-rr-pencil-ruler', tone: 'bg-sky-50 text-sky-700',
        needs: 'manage gate-passes',
    },
    pcd: {
        who: "PCD's নির্বাহী প্রকৌশলী — passes raised from PCD → Gate Passes.",
        icon: 'fi-rr-settings', tone: 'bg-amber-50 text-amber-700',
        needs: 'view pcd',
    },
};

function DeskCard({ desk, d }: { desk: string; d: Desk }) {
    const { data, setData, post, processing, reset } = useForm({ user_id: '', desk });
    const about = ABOUT[desk];

    const add = () => {
        if (!data.user_id) return;
        post('/admin/gate-pass-approvers', { preserveScroll: true, onSuccess: () => reset('user_id') });
    };
    const remove = (id: number) => {
        if (!confirm(`Remove this ${d.label} approver?`)) return;
        router.delete(`/admin/gate-pass-approvers/${id}`, { preserveScroll: true });
    };

    return (
        <div className="card">
            <div className="card-header flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${about.tone}`}>
                    <i className={`fi ${about.icon} text-base leading-none`} />
                </div>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-surface-900">{d.label} gate passes</h2>
                    <p className="text-xs text-surface-500 mt-0.5">Approved by {about.who}</p>
                </div>
                <span className="ml-auto badge badge-slate shrink-0">{d.approvers.length}</span>
            </div>
            <div className="card-body space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="form-group flex-1 mb-0">
                        <label className="form-label">Add a {d.label} approver</label>
                        <select value={data.user_id} onChange={e => setData('user_id', e.target.value)} className="form-select">
                            <option value="">Select a user…</option>
                            {d.candidates.map(c => (
                                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" onClick={add} disabled={processing || !data.user_id} className="btn-primary">
                        <i className="fi fi-rr-plus text-xs" /> Add
                    </button>
                </div>

                {d.approvers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-surface-200 px-4 py-5 text-center">
                        <div className="text-sm font-semibold text-surface-700">No {d.label} approvers</div>
                        <div className="text-xs text-surface-500 mt-1">
                            {d.label} gate passes are issued straight away. Add someone and every new {d.label} pass waits for them.
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-surface-100 border border-surface-100 rounded-xl">
                        {d.approvers.map(a => (
                            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                                    {a.user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-surface-900">
                                        {a.user.name}
                                        {a.inactive && <span className="ml-2 badge badge-red">Inactive</span>}
                                    </div>
                                    <div className="text-[11px] text-surface-500">{a.user.email} · added {a.added}</div>
                                    {/* Told a pass is waiting, then refused at the door — say so here. */}
                                    {!a.can_open && (
                                        <div className="text-[11px] text-amber-700 mt-1">
                                            Cannot open {d.label} gate passes — give their role <b>{about.needs}</b> in Admin → Roles.
                                        </div>
                                    )}
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
    );
}

export default function GatePassApprovers({ desks, centreName }: { desks: Record<string, Desk>; centreName?: string }) {
    return (
        <AppLayout header="Gate Pass Approvers">
            <div className="max-w-3xl space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-lg font-bold text-surface-900">Gate Pass Approvers</h1>
                    <p className="text-sm text-surface-500 mt-0.5">
                        Each desk approves its own passes — <b>any one</b> of its approvers finalises a pass, and they are
                        notified when one is waiting.{centreName && <> These are <b>{centreName}</b>'s approvers.</>}
                    </p>
                </div>
                {Object.entries(desks).map(([key, d]) => <DeskCard key={key} desk={key} d={d} />)}
            </div>
        </AppLayout>
    );
}
