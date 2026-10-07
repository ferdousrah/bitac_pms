import { router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export interface Assignment {
    active: boolean;
    assigned_to: string | null;
    assigned_to_id: number | null;
    assigned_by: string | null;
    assigned_at: string | null;
    received_at: string | null;
    note: string | null;
    can_forward: boolean;
    /** Sending the WHOLE job to a bench moves every open step — the XEN's call. */
    can_send_to_sub: boolean;
    can_receive: boolean;
    can_hand_back: boolean;
    blocker: string | null;
    /**
     * Why this shop has no chain of command. `fact` is for whoever is on the
     * page; `fix` is the admin step and arrives only for someone who can take it.
     */
    setup_hint?: { fact: string; fix: string | null } | null;
    assistants: { id: number; name: string; designation: string | null }[];
    sub_sections: { id: number; name: string }[];
}

/**
 * The shop's chain of command on one job.
 *
 * A job reaching a shop is the নির্বাহী প্রকৌশলী's until he forwards it — to
 * one of his assistant engineers, who then owns it here, or straight to a
 * sub-section. The engineer receives it before working on it, and can hand it
 * back with a reason.
 *
 * ⚠️ Renders nothing at all when the shop does not work this way (`active`
 * false), so shops with no XEN look exactly as they always did.
 */
export default function ShopHandover({ wosId, assignment }: { wosId: number; assignment: Assignment }) {
    const [showForward, setShowForward] = useState(false);
    const [showBack, setShowBack] = useState(false);

    const forward = useForm<any>({
        mode: 'engineer',
        assigned_to: assignment.assistants[0]?.id ?? '',
        sub_section_id: assignment.sub_sections[0]?.id ?? '',
        note: '',
    });
    const handBack = useForm<any>({ reason: '' });

    // ⚠️ A shop with no নির্বাহী প্রকৌশলী works exactly as it always did, and
    // that stays. But showing NOTHING read as a missing feature — "how does an
    // Assistant Engineer ever get this job?" — so an admin is told that turning
    // it on is their act. Everyone else still sees nothing.
    if (!assignment.active) {
        if (!assignment.setup_hint) return null;

        return (
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 p-3.5 flex items-start gap-2.5">
                <i className="fi fi-rr-users-alt text-surface-400 text-base leading-none mt-0.5" />
                <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-surface-700">
                        No shop in-charge — this job is not held by a person
                    </div>
                    <p className="text-[11px] text-surface-500 leading-relaxed">{assignment.setup_hint.fact}</p>
                    {assignment.setup_hint.fix && (
                        <p className="text-[11px] text-brand-700 leading-relaxed">{assignment.setup_hint.fix}</p>
                    )}
                </div>
            </div>
        );
    }

    const submitForward = (e: FormEvent) => {
        e.preventDefault();
        forward.post(`/production/wos/${wosId}/forward`, {
            preserveScroll: true,
            onSuccess: () => { setShowForward(false); forward.setData('note', ''); },
        });
    };
    const submitBack = (e: FormEvent) => {
        e.preventDefault();
        handBack.post(`/production/wos/${wosId}/hand-back`, {
            preserveScroll: true,
            onSuccess: () => setShowBack(false),
        });
    };
    const receive = () =>
        router.post(`/production/wos/${wosId}/receive`, {}, { preserveScroll: true });

    const held = assignment.assigned_to !== null;
    const waiting = held && assignment.received_at === null;

    return (
        <>
            <div className={`rounded-2xl border overflow-hidden ${waiting
                ? 'border-amber-200 bg-amber-50/50'
                : held ? 'border-emerald-200 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/40'}`}>
                <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${waiting
                            ? 'bg-amber-100 text-amber-700'
                            : held ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            <i className={`fi ${held ? 'fi-rr-user-gear' : 'fi-rr-inbox'} text-sm leading-none`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-surface-900">
                                {held
                                    ? `With ${assignment.assigned_to}`
                                    : 'With the নির্বাহী প্রকৌশলী'}
                                {waiting && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border font-bold bg-amber-100 text-amber-800 border-amber-200">
                                    not received yet
                                </span>}
                            </p>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                {held
                                    ? [
                                        assignment.assigned_by ? `forwarded by ${assignment.assigned_by}` : null,
                                        assignment.assigned_at,
                                        assignment.received_at ? `received ${assignment.received_at}` : null,
                                      ].filter(Boolean).join(' · ')
                                    : 'He reads the job and forwards it to an assistant engineer, or straight to a sub-section.'}
                            </p>
                            {assignment.note && (
                                <p className="text-[11px] text-surface-600 mt-1.5 bg-white/70 border border-surface-100 rounded-lg px-2.5 py-1.5">
                                    “{assignment.note}”
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {assignment.can_receive && (
                            <button type="button" onClick={receive} className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 border-emerald-600">
                                <i className="fi fi-rr-check text-xs leading-none" /> Receive
                            </button>
                        )}
                        {assignment.can_hand_back && (
                            <button type="button" onClick={() => setShowBack(true)} className="btn-outline btn-sm">
                                <i className="fi fi-rr-undo text-xs leading-none" /> Hand back
                            </button>
                        )}
                        {assignment.can_forward && (
                            <button type="button" onClick={() => setShowForward(true)} className="btn-primary btn-sm">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                {held
                                    ? (assignment.can_send_to_sub ? 'Re-forward' : 'Pass on')
                                    : 'Forward'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Why this viewer cannot work on it yet, in plain words. */}
                {assignment.blocker && (
                    <div className="px-4 py-2.5 bg-white/70 border-t border-surface-100">
                        <p className="text-[11px] text-surface-600">
                            <i className="fi fi-rr-lock text-[10px] leading-none mr-1" />
                            {assignment.blocker}
                        </p>
                    </div>
                )}
            </div>

            {/* Forward */}
            {showForward && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForward(false)} />
                    <form onSubmit={submitForward} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Forward this job</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                To one of your engineers, or straight to a sub-section.
                            </p>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className={`grid gap-2 ${assignment.can_send_to_sub ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {[
                                    { key: 'engineer', label: 'To an engineer', hint: 'He receives it and owns the job here' },
                                    // ⚠️ Only the XEN: it moves every open step at once.
                                    ...(assignment.can_send_to_sub
                                        ? [{ key: 'sub_section', label: 'To a sub-section', hint: 'Every open step moves to that bench' }]
                                        : []),
                                ].map((opt) => (
                                    <label key={opt.key}
                                        className={`p-3 rounded-xl border cursor-pointer transition-colors ${forward.data.mode === opt.key
                                            ? 'border-brand-300 bg-brand-50'
                                            : 'border-surface-200 hover:bg-surface-50'}`}>
                                        <input type="radio" className="sr-only" checked={forward.data.mode === opt.key}
                                            onChange={() => forward.setData('mode', opt.key)} />
                                        <span className="text-sm font-bold text-surface-900 block">{opt.label}</span>
                                        <span className="text-[11px] text-surface-500 leading-tight block mt-0.5">{opt.hint}</span>
                                    </label>
                                ))}
                            </div>

                            {forward.data.mode === 'engineer' ? (
                                <div className="form-group !mb-0">
                                    <label className="form-label">Engineer <span className="text-red-500">*</span></label>
                                    {assignment.assistants.length === 0 ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            Nobody else is posted to this shop. Post the assistant engineers to it
                                            under Admin → Users to forward a job to them.
                                        </p>
                                    ) : (
                                        <select className="form-input" value={forward.data.assigned_to}
                                            onChange={(e) => forward.setData('assigned_to', e.target.value)}>
                                            {assignment.assistants.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name}{a.designation ? ` — ${a.designation}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {forward.errors.assigned_to && <p className="form-error">{forward.errors.assigned_to as any}</p>}
                                </div>
                            ) : (
                                <div className="form-group !mb-0">
                                    <label className="form-label">Sub-section <span className="text-red-500">*</span></label>
                                    {assignment.sub_sections.length === 0 ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            This shop has no sub-sections.
                                        </p>
                                    ) : (
                                        <select className="form-input" value={forward.data.sub_section_id}
                                            onChange={(e) => forward.setData('sub_section_id', e.target.value)}>
                                            {assignment.sub_sections.map((x) => (
                                                <option key={x.id} value={x.id}>{x.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            <div className="form-group !mb-0">
                                <label className="form-label">Note <span className="form-label-optional">Optional</span></label>
                                <textarea className="form-textarea" rows={2} value={forward.data.note}
                                    onChange={(e) => forward.setData('note', e.target.value)}
                                    placeholder="Anything he should know before starting…" />
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowForward(false)} className="btn-ghost">Cancel</button>
                            <button type="submit" className="btn-primary"
                                disabled={forward.processing
                                    || (forward.data.mode === 'engineer' && !forward.data.assigned_to)
                                    || (forward.data.mode === 'sub_section' && !forward.data.sub_section_id)}>
                                <i className="fi fi-rr-paper-plane text-xs leading-none" /> Forward
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Hand back */}
            {showBack && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBack(false)} />
                    <form onSubmit={submitBack} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Hand this job back</h3>
                        </div>
                        <div className="p-5">
                            <div className="form-group !mb-0">
                                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                                <textarea className="form-textarea" rows={3} value={handBack.data.reason}
                                    onChange={(e) => handBack.setData('reason', e.target.value)}
                                    placeholder="Why can you not take this on?" />
                                {handBack.errors.reason && <p className="form-error">{handBack.errors.reason as any}</p>}
                                <p className="form-hint">
                                    A job coming back with no explanation is one that gets lost — the
                                    নির্বাহী প্রকৌশলী is told what you say here.
                                </p>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowBack(false)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={handBack.processing || !handBack.data.reason.trim()}
                                className="btn bg-red-600 hover:bg-red-500 text-white disabled:opacity-40">
                                <i className="fi fi-rr-undo text-xs leading-none" /> Hand back
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
