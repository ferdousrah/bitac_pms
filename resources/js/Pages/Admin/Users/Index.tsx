import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

export default function UsersIndex({ users }: any) {
    const { post } = useForm({});
    const rows = users?.data ?? users ?? [];

    return (
        <AppLayout header="User Management">
            <div className="space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-surface-900">All Users</h2>
                            <p className="text-sm text-surface-500 mt-0.5">
                                {rows.length} user{rows.length !== 1 && 's'} registered
                            </p>
                        </div>
                        <Link href="/admin/users/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-user-add mr-1.5" />
                            New User
                        </Link>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-users text-2xl" />
                                </div>
                                <div className="empty-state-title">No users found</div>
                                <div className="empty-state-text">Get started by creating the first user account.</div>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((user: any) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                        {user.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-surface-900">{user.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-surface-600">{user.email}</td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {user.roles?.map((r: string) => (
                                                        <span key={r} className="badge badge-purple">
                                                            {r.replace(/-/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={user.is_active ? 'badge badge-green' : 'badge badge-red'}>
                                                    <i className={`fi fi-sr-${user.is_active ? 'check-circle' : 'cross-circle'} mr-1 text-[10px]`} />
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link href={`/admin/users/${user.id}/edit`} className="btn-outline btn-xs">
                                                        <i className="fi fi-rr-pencil mr-1" />
                                                        Edit
                                                    </Link>
                                                    {user.is_active ? (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Deactivate ${user.name}? They will not be able to log in.`)) {
                                                                    post(`/admin/users/${user.id}/deactivate`);
                                                                }
                                                            }}
                                                            className="btn-danger btn-xs"
                                                        >
                                                            <i className="fi fi-rr-ban mr-1" />
                                                            Deactivate
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => post(`/admin/users/${user.id}/activate`)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
                                                        >
                                                            <i className="fi fi-rr-check mr-1" />
                                                            Activate
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden card-body space-y-3">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-users text-2xl" />
                                </div>
                                <div className="empty-state-title">No users found</div>
                                <div className="empty-state-text">Get started by creating the first user account.</div>
                            </div>
                        ) : (
                            rows.map((user: any) => (
                                <div key={user.id} className="rounded-xl border border-surface-200 p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                            {user.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-surface-900 truncate">{user.name}</div>
                                            <div className="text-sm text-surface-500 truncate">{user.email}</div>
                                        </div>
                                        <span className={user.is_active ? 'badge badge-green' : 'badge badge-red'}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles?.map((r: string) => (
                                            <span key={r} className="badge badge-purple">
                                                {r.replace(/-/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-surface-100">
                                        <Link href={`/admin/users/${user.id}/edit`} className="btn-outline btn-xs">
                                            <i className="fi fi-rr-pencil mr-1" />
                                            Edit
                                        </Link>
                                        {user.is_active ? (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Deactivate ${user.name}?`)) post(`/admin/users/${user.id}/deactivate`);
                                                }}
                                                className="btn-danger btn-xs"
                                            >
                                                <i className="fi fi-rr-ban mr-1" />
                                                Deactivate
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => post(`/admin/users/${user.id}/activate`)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
                                            >
                                                <i className="fi fi-rr-check mr-1" />
                                                Activate
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
