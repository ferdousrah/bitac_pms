import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import SignatureManager from '@/Components/SignatureManager';

export default function UserCreateEdit({ user, roles, sections = [], centers = [], canPickCentre = false, crossCentreRoles = [], handover = null }: any) {
    // Handing the post to the next person (PostHandover) — its own small form.
    const [handingOver, setHandingOver] = useState(false);
    const ho = useForm({ new_name: '', new_designation: user?.designation ?? '', new_phone: '', new_password: '' });
    const submitHandover = (e: FormEvent) => {
        e.preventDefault();
        if (!confirm(`Hand ${user.name}'s post to ${ho.data.new_name}? ${user.name}'s account will be retired with everything done on it, under their own name.`)) return;
        ho.post(`/admin/users/${user.id}/hand-over`, { preserveScroll: true, onSuccess: () => setHandingOver(false) });
    };
    const { data, setData, post, transform, errors, processing } = useForm<any>({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        designation: user?.designation ?? '',
        password: '',
        password_confirmation: '',
        role: user?.roles?.[0] ?? '',
        section_id: user?.section_id ?? '',
        // A new account defaults to the only centre on offer (a centre admin's own).
        center_id: user ? (user.center_id ?? '') : (centers.length === 1 ? centers[0].id : ''),
        is_active: user?.is_active ?? true,
        deactivation_reason: user?.deactivation_reason ?? '',
        signature: null as File | null,
    });

    // Local preview state so the user sees the chosen image before submit.
    const [sigPreview, setSigPreview] = useState<string | null>(user?.signature_url ?? null);

    const onSignaturePicked = (file: File | null) => {
        setData('signature', file);
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setSigPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setSigPreview(user?.signature_url ?? null);
        }
    };

    const clearSignature = () => {
        setData('signature', null);
        setSigPreview(null);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (user) {
            // Laravel method spoofing — needed because PUT cannot carry multipart/form-data
            transform((d: any) => ({ ...d, _method: 'put' }));
            post(`/admin/users/${user.id}`, { forceFormData: true });
        } else {
            post('/admin/users', { forceFormData: true });
        }
    };

    return (
        <AppLayout header={user ? 'Edit User' : 'New User'}>
            <div className="max-w-2xl animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                <i className={`fi fi-rr-${user ? 'pencil' : 'user-add'} text-lg`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">
                                    {user ? 'Edit User' : 'Create New User'}
                                </h2>
                                <p className="text-sm text-surface-500">
                                    {user ? 'Update user account details' : 'Set up a new user account with role assignment'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card-body">
                        {user?.handed_over_to && (
                            <div className="mb-5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <b>Retired account.</b> The post was handed over to{' '}
                                <Link href={`/admin/users/${user.handed_over_to.id}/edit`} className="font-semibold text-brand-600 hover:underline">{user.handed_over_to.name}</Link>
                                {user.handed_over_to.at && <> on {user.handed_over_to.at}</>}. Everything {user.name} signed and approved stays
                                under their name — leave this account as it is.
                            </div>
                        )}
                        {user?.took_over_from && (
                            <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                                Took over this post from{' '}
                                <Link href={`/admin/users/${user.took_over_from.id}/edit`} className="font-semibold hover:underline">{user.took_over_from.name}</Link>
                                {user.took_over_from.at && <> on {user.took_over_from.at}</>}. Work done before that stays under {user.took_over_from.name}'s name.
                            </div>
                        )}
                        <form onSubmit={submit} className="space-y-5">
                            <div className="form-group">
                                <label className="form-label">
                                    Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData('name', e.target.value)}
                                    className="form-input"
                                    placeholder="Enter full name"
                                    required
                                />
                                {errors.name && <p className="form-error">{errors.name}</p>}
                                {user?.has_history && data.name.trim() !== user.name && (
                                    <p className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                                        ⚠️ Renaming puts the new name on everything this account has already signed and approved.
                                        Correct a spelling here — but if a <b>different person</b> has taken the post, use
                                        <b> Hand over to the next person</b> below instead.
                                    </p>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={e => setData('email', e.target.value)}
                                    className="form-input"
                                    placeholder="user@example.com"
                                    required
                                />
                                {errors.email && <p className="form-error">{errors.email}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Phone / Mobile</label>
                                <p className="form-hint">Shown on outgoing quotation letters (e.g. ফোনঃ 01914-894085). Optional.</p>
                                <input
                                    type="tel"
                                    value={data.phone}
                                    onChange={e => setData('phone', e.target.value)}
                                    className="form-input"
                                    placeholder="01914-894085"
                                />
                                {errors.phone && <p className="form-error">{errors.phone}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Designation</label>
                                <p className="form-hint">Job title — shown under the name on every signature block (Cost Estimate, Quotation PDFs). e.g. "Executive Engineer" / "নির্বাহী প্রকৌশলী".</p>
                                <input
                                    type="text"
                                    value={data.designation}
                                    onChange={e => setData('designation', e.target.value)}
                                    className="form-input"
                                    placeholder="Executive Engineer"
                                />
                                {errors.designation && <p className="form-error">{errors.designation}</p>}
                            </div>

                            {/* Signatures.
                                Editing: the full manager — a user may hold several blocks
                                (Bangla, English, one per post) and mark one default. Those
                                have their own endpoints, so they save on their own and are
                                not part of this form's submit.
                                Creating: one optional upload, which becomes their default;
                                the manager needs a user id to post against. */}
                            {user ? (
                                <div className="form-group">
                                    <label className="form-label">Signatures</label>
                                    <SignatureManager
                                        signatures={user.signatures ?? []}
                                        ownerLabel={user.name}
                                        storeUrl={`/admin/users/${user.id}/signatures`}
                                        defaultUrl={(id) => `/admin/users/signatures/${id}/default`}
                                        destroyUrl={(id) => `/admin/users/signatures/${id}`}
                                    />
                                </div>
                            ) : (
                            <div className="form-group">
                                <label className="form-label">Signature</label>
                                <p className="form-hint">The scanned signature block. It becomes this user’s default; more can be added after the user is created. Max 2 MB.</p>

                                {sigPreview ? (
                                    <div className="flex items-start gap-4 p-3 rounded-xl border border-surface-200 bg-surface-50/60">
                                        <img
                                            src={sigPreview}
                                            alt="Signature preview"
                                            className="h-20 w-auto max-w-[260px] object-contain bg-white border border-surface-100 rounded"
                                        />
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <label className="btn-outline cursor-pointer text-xs self-start">
                                                <i className="fi fi-rr-refresh text-[10px] leading-none" />
                                                Replace
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg"
                                                    className="hidden"
                                                    onChange={e => onSignaturePicked(e.target.files?.[0] ?? null)}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={clearSignature}
                                                className="text-xs text-red-600 hover:text-red-700 self-start flex items-center gap-1 mt-1"
                                            >
                                                <i className="fi fi-rr-trash text-[10px] leading-none" />
                                                Remove signature
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/40 hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer">
                                        <i className="fi fi-rr-signature text-brand-500 text-base leading-none" />
                                        <span className="text-sm text-surface-600">Click to upload signature image</span>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            className="hidden"
                                            onChange={e => onSignaturePicked(e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                )}
                                {errors.signature && <p className="form-error">{errors.signature as any}</p>}
                            </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">
                                    {user ? 'New Password' : 'Password'} {!user && <span className="text-red-500">*</span>}
                                </label>
                                {user && <p className="form-hint">Leave blank to keep current password</p>}
                                <input
                                    type="password"
                                    value={data.password}
                                    onChange={e => setData('password', e.target.value)}
                                    className="form-input"
                                    placeholder={user ? 'Enter new password' : 'Enter password'}
                                    required={!user}
                                />
                                {errors.password && <p className="form-error">{errors.password}</p>}
                            </div>

                            {data.password && (
                                <div className="form-group animate-slide-up">
                                    <label className="form-label">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={e => setData('password_confirmation', e.target.value)}
                                        className="form-input"
                                        placeholder="Re-enter password"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.role}
                                    onChange={e => setData('role', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select role...</option>
                                    {roles?.map((r: string) => (
                                        <option key={r} value={r}>
                                            {r.replace(/-/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                {errors.role && <p className="form-error">{errors.role}</p>}
                            </div>

                            {/* Which centre they work at — every centre-scoped screen reads it. */}
                            <div className="form-group">
                                <label className="form-label">
                                    Centre {!crossCentreRoles.includes(data.role) && <span className="text-red-500">*</span>}
                                </label>
                                {canPickCentre ? (
                                    <select
                                        value={data.center_id ?? ''}
                                        onChange={e => setData('center_id', e.target.value ? Number(e.target.value) : '')}
                                        className="form-select"
                                    >
                                        <option value="">
                                            {crossCentreRoles.includes(data.role) ? '— None: sees every centre (Head Office) —' : 'Select centre...'}
                                        </option>
                                        {centers.map((c: any) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.code}){c.is_active ? '' : ' — inactive'}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="form-input bg-surface-50 text-surface-700">{centers[0]?.name ?? '—'}</div>
                                )}
                                {errors.center_id
                                    ? <p className="form-error">{errors.center_id}</p>
                                    : <p className="form-hint">
                                        {canPickCentre
                                            ? 'They see and work on this centre’s jobs only. Head Office and the super admin may be left without one — they look across every centre.'
                                            : 'People you add work at your centre.'}
                                    </p>}
                            </div>

                            {/* Section assignment — supervisors of this section see only its production queue */}
                            <div className="form-group">
                                <label className="form-label">
                                    Production Section <span className="form-label-optional">optional</span>
                                </label>
                                <select
                                    value={data.section_id ?? ''}
                                    onChange={e => setData('section_id', e.target.value ? Number(e.target.value) : '')}
                                    className="form-select"
                                >
                                    <option value="">— Not assigned to a section —</option>
                                    {/* ⚠️ A flat list cannot say which of these is a SHOP and which
                                        is a bench inside one, and the two mean different jobs. The
                                        parent must stay selectable (a shop's XEN and his engineers
                                        are posted to the shop itself), so an <optgroup> is wrong
                                        here — sub-sections are indented and name their parent, the
                                        same convention as the machine form. */}
                                    {sections?.map((s: any) => (
                                        <option key={s.id} value={s.id}>
                                            {s.parent_id
                                                ? `   ↳ ${s.name} (${s.code}) — under ${s.parent_name}`
                                                : `${s.name} (${s.code})`}
                                        </option>
                                    ))}
                                </select>
                                <p className="form-hint">
                                    Post someone to the <strong>shop</strong> itself if they run it or work
                                    for whoever does — the in-charge (নির্বাহী প্রকৌশলী) and his AE / SAE.
                                    Post them to an indented <strong>↳ sub-section</strong> only if they
                                    run that bench: they then see just the steps assigned to it.
                                </p>
                                {errors.section_id && <p className="form-error">{errors.section_id}</p>}
                            </div>

                            {/* ── Account Status toggle ───────────────────── */}
                            <div className="form-group">
                                <label className="form-label">Account Status</label>
                                <div className={`rounded-xl border-2 p-4 transition-colors ${
                                    data.is_active
                                        ? 'bg-emerald-50/50 border-emerald-200'
                                        : 'bg-red-50/50 border-red-200'
                                }`}>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        {/* Custom toggle switch */}
                                        <div className="relative shrink-0 mt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={data.is_active}
                                                onChange={e => setData('is_active', e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-11 h-6 rounded-full transition-colors ${
                                                data.is_active ? 'bg-emerald-500' : 'bg-red-400'
                                            }`}>
                                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                                                    data.is_active ? 'translate-x-5' : 'translate-x-0.5'
                                                }`} />
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-bold ${data.is_active ? 'text-emerald-800' : 'text-red-800'}`}>
                                                {data.is_active ? '✅ Active' : '🚫 Deactivated'}
                                            </div>
                                            <div className="text-xs text-surface-600 mt-0.5">
                                                {data.is_active
                                                    ? 'User can log in and access the system normally.'
                                                    : 'User is blocked from logging in. Login attempts will be rejected.'}
                                            </div>
                                        </div>
                                    </label>

                                    {/* Deactivation reason (optional) */}
                                    {!data.is_active && (
                                        <div className="mt-3 pt-3 border-t border-red-200 animate-slide-up">
                                            <label className="form-label text-xs text-red-800">
                                                Deactivation Reason <span className="text-surface-400 font-normal">(shown on login attempt)</span>
                                            </label>
                                            <textarea
                                                value={data.deactivation_reason}
                                                onChange={e => setData('deactivation_reason', e.target.value)}
                                                rows={2}
                                                placeholder="e.g. Left the organization, Account compromised..."
                                                className="form-textarea border-red-200 focus:border-red-400 focus:ring-red-100 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-surface-200">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="btn-primary"
                                >
                                    {processing ? (
                                        <>
                                            <i className="fi fi-rr-spinner animate-spin mr-1.5" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <i className={`fi fi-rr-${user ? 'check' : 'plus'} mr-1.5`} />
                                            {user ? 'Update User' : 'Create User'}
                                        </>
                                    )}
                                </button>
                                <Link href="/admin/users" className="btn-ghost">
                                    Cancel
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>

                {/* The post goes to the next person — the account is not renamed (PostHandover). */}
                {user && handover !== null && (
                    <div className="card mt-6 border-violet-200">
                        <div className="card-body">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-surface-900">Hand over to the next person</h3>
                                    <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                                        When someone else takes this post. <b>{user.name}</b>'s account is retired with everything they signed and
                                        approved — it stays under their name and their signature. A new account opens on <b>{user.email}</b> with the
                                        same role, centre and posting, and only what is still waiting moves to it.
                                    </p>
                                </div>
                                <button type="button" onClick={() => setHandingOver(true)} className="btn-outline shrink-0">
                                    <i className="fi fi-rr-exchange text-xs leading-none" /> Hand over
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {handingOver && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !ho.processing && setHandingOver(false)} />
                    <form onSubmit={submitHandover} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Hand over {user.name}'s post</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">The new person signs in with <b>{user.email}</b> and the password you set here.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="form-label">New person's name *</label>
                                <input className="form-input" value={ho.data.new_name} required autoFocus
                                    onChange={(e) => ho.setData('new_name', e.target.value)} placeholder="e.g. Abdul Karim" />
                                {ho.errors.new_name && <p className="form-error">{ho.errors.new_name}</p>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Designation</label>
                                    <input className="form-input" value={ho.data.new_designation}
                                        onChange={(e) => ho.setData('new_designation', e.target.value)} />
                                </div>
                                <div>
                                    <label className="form-label">Phone / Mobile</label>
                                    <input className="form-input" value={ho.data.new_phone}
                                        onChange={(e) => ho.setData('new_phone', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Password for the new person *</label>
                                <input type="text" className="form-input font-mono" value={ho.data.new_password} required minLength={8}
                                    onChange={(e) => ho.setData('new_password', e.target.value)} placeholder="At least 8 characters" />
                                {ho.errors.new_password && <p className="form-error">{ho.errors.new_password}</p>}
                            </div>
                            <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3 text-xs text-surface-700">
                                <div className="font-semibold text-surface-900 mb-1">Moves to the new person — still waiting on the post:</div>
                                {Object.keys(handover).length === 0
                                    ? <div className="text-surface-500">Nothing is waiting.</div>
                                    : <ul className="list-disc pl-4 space-y-0.5">
                                        {Object.entries(handover).map(([label, n]: any) => <li key={label}>{n} {label}</li>)}
                                      </ul>}
                                <div className="mt-2 text-surface-500">
                                    Stays with {user.name}: everything already signed, approved, raised or done — and their signatures.
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setHandingOver(false)} disabled={ho.processing} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={ho.processing} className="btn-primary">{ho.processing ? 'Handing over…' : 'Hand over'}</button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}
