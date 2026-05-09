import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface RoleRow {
    id: number;
    name: string;
    permissions_count: number;
    users_count: number;
    is_protected: boolean;
}

interface Props {
    roles: RoleRow[];
    total_permissions: number;
}

export default function RolesIndex({ roles, total_permissions }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<RoleRow | null>(null);

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(`/admin/roles/${confirmDelete.id}`, {
            preserveScroll: true,
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout header="Roles & Permissions">
            <div className="space-y-6 animate-fade-in">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Roles & Permissions</h1>
                        <p className="page-subtitle">
                            Define roles and assign granular access to BITAC PMS modules
                        </p>
                    </div>
                    <Link href="/admin/roles/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Role
                    </Link>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="card p-4 transition-all duration-300 hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-brand-200">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-users-alt leading-none" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 tabular-nums leading-none">{roles.length}</div>
                                <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mt-1">Total Roles</div>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 transition-all duration-300 hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-brand-200">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-key leading-none" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 tabular-nums leading-none">{total_permissions}</div>
                                <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mt-1">Permissions</div>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 transition-all duration-300 hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-brand-200">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-user-check leading-none" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 tabular-nums leading-none">
                                    {roles.reduce((s, r) => s + r.users_count, 0)}
                                </div>
                                <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mt-1">Users Assigned</div>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 transition-all duration-300 hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-brand-200">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-shield-check leading-none" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-surface-900 tabular-nums leading-none">
                                    {roles.filter(r => r.is_protected).length}
                                </div>
                                <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold mt-1">Protected</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Roles list */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-shield leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-800">All Roles</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Click a role to manage its permissions</p>
                            </div>
                        </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th>Permissions</th>
                                    <th>Users</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map(role => (
                                    <tr key={role.id} className="group">
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                                    role.is_protected
                                                        ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                                                        : 'bg-gradient-to-br from-surface-600 to-surface-800'
                                                }`}>
                                                    {role.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-surface-800">{role.name}</div>
                                                    {role.is_protected && (
                                                        <div className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Built-in</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 max-w-[140px] h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                                                         style={{ width: `${total_permissions > 0 ? (role.permissions_count / total_permissions) * 100 : 0}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-surface-700 tabular-nums w-12">
                                                    {role.permissions_count}/{total_permissions}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-blue">
                                                <i className="fi fi-rr-user text-[9px] leading-none" />
                                                {role.users_count}
                                            </span>
                                        </td>
                                        <td>
                                            {role.is_protected ? (
                                                <span className="badge badge-amber">
                                                    <i className="fi fi-rr-lock text-[9px] leading-none" /> Protected
                                                </span>
                                            ) : (
                                                <span className="badge badge-green">
                                                    <i className="fi fi-rr-check text-[9px] leading-none" /> Editable
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1">
                                                {role.is_protected ? (
                                                    <span className="text-xs text-surface-400 italic">No actions</span>
                                                ) : (
                                                    <>
                                                        <Link href={`/admin/roles/${role.id}/edit`} className="btn-ghost btn-xs">
                                                            <i className="fi fi-rr-edit text-xs leading-none" /> Edit
                                                        </Link>
                                                        <button
                                                            onClick={() => setConfirmDelete(role)}
                                                            disabled={role.users_count > 0}
                                                            title={role.users_count > 0 ? 'Cannot delete — users still assigned' : 'Delete role'}
                                                            className="btn-ghost btn-xs text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <i className="fi fi-rr-trash text-xs leading-none" /> Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {roles.length === 0 && (
                                    <tr><td colSpan={5}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon"><i className="fi fi-rr-shield" /></div>
                                            <p className="empty-state-title">No roles defined</p>
                                            <p className="empty-state-text">Create your first role to get started.</p>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden card-body space-y-3">
                        {roles.map(role => (
                            <div key={role.id} className={`rounded-xl border p-4 transition-all
                                ${role.is_protected ? 'border-amber-200 bg-amber-50/40' : 'border-surface-100 bg-surface-50/50'}`}>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                            role.is_protected
                                                ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                                                : 'bg-gradient-to-br from-surface-600 to-surface-800'
                                        }`}>
                                            {role.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-surface-800 text-sm">{role.name}</div>
                                            <div className="text-[10px] text-surface-500">
                                                {role.permissions_count} permissions · {role.users_count} users
                                            </div>
                                        </div>
                                    </div>
                                    {role.is_protected && (
                                        <span className="badge badge-amber text-[9px]">
                                            <i className="fi fi-rr-lock leading-none" />
                                        </span>
                                    )}
                                </div>
                                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden mb-3">
                                    <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                                         style={{ width: `${total_permissions > 0 ? (role.permissions_count / total_permissions) * 100 : 0}%` }} />
                                </div>
                                {!role.is_protected && (
                                    <div className="flex items-center gap-2">
                                        <Link href={`/admin/roles/${role.id}/edit`} className="btn-outline btn-xs flex-1 justify-center">
                                            <i className="fi fi-rr-edit text-xs leading-none" /> Edit
                                        </Link>
                                        <button
                                            onClick={() => setConfirmDelete(role)}
                                            disabled={role.users_count > 0}
                                            className="btn-ghost btn-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                                        >
                                            <i className="fi fi-rr-trash text-xs leading-none" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delete confirm */}
                {confirmDelete && (
                    <>
                        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade-in"
                             onClick={() => setConfirmDelete(null)} />
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-sm animate-scale-in overflow-hidden">
                                <div className="p-6 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                                        <i className="fi fi-rr-trash text-red-500 text-2xl leading-none" />
                                    </div>
                                    <h3 className="text-lg font-bold text-surface-900">Delete role?</h3>
                                    <p className="text-sm text-surface-500 mt-2">
                                        You're about to delete <strong className="text-surface-800">{confirmDelete.name}</strong>.
                                        This action cannot be undone.
                                    </p>
                                </div>
                                <div className="px-6 pb-6 flex gap-3">
                                    <button onClick={() => setConfirmDelete(null)} className="btn-outline flex-1">Cancel</button>
                                    <button onClick={handleDelete} className="btn-danger flex-1">
                                        <i className="fi fi-rr-trash text-sm leading-none" /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
