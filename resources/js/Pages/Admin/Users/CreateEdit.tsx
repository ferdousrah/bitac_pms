import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function UserCreateEdit({ user, roles }: any) {
    const { data, setData, post, put, errors, processing } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        role: user?.roles?.[0] ?? '',
        is_active: user?.is_active ?? true,
        deactivation_reason: user?.deactivation_reason ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (user) {
            put(`/admin/users/${user.id}`);
        } else {
            post('/admin/users');
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
            </div>
        </AppLayout>
    );
}
