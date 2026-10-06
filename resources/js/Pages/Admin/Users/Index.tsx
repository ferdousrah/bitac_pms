import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function UsersIndex({ users, roles = [], sections = [], filters = {} }: any) {
    const { post } = useForm({});
    const rows = users?.data ?? users ?? [];

    // `users.total` is how many people there are; `rows.length` is how many fit
    // on this page. The header printed rows.length and called it "registered",
    // so with 16 users and a page of 15 it read "15 users registered" — and the
    // sixteenth could not be reached, because the page had no pagination links.
    const total = users?.total ?? rows.length;

    const [search, setSearch] = useState(filters.search ?? '');

    const go = (patch: Record<string, any>) =>
        router.get('/admin/users', {
            search,
            role: filters.role ?? '',
            section_id: filters.section_id ?? '',
            status: filters.status ?? '',
            sort: filters.sort ?? '',
            dir: filters.dir ?? '',
            ...patch,
        }, { preserveState: true, preserveScroll: true, replace: true });

    const clearFilters = () => {
        setSearch('');
        router.get('/admin/users', {}, { preserveState: true, replace: true });
    };

    const activeFilters = [filters.search, filters.role, filters.section_id, filters.status]
        .filter((v) => v !== '' && v !== undefined && v !== null).length;

    // ⚠️ `can_delete` is decided by the SERVER (super admin, and the account has
    // done nothing). Deleting one that has worked cascades to their quotations
    // and work orders, so a row the guard would refuse is never offered here.
    const destroy = (user: any) => {
        if (! confirm(
            `Delete ${user.name} permanently?\n\nThis account has no work against it, so nothing else is removed. `
            + `To retire someone who HAS worked, use Deactivate instead \u2014 their work stays on the record.`
        )) return;
        router.delete(`/admin/users/${user.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="User Management">
            <div className="space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-surface-900">All Users</h2>
                            <p className="text-sm text-surface-500 mt-0.5">
                                {total} user{total !== 1 && 's'}
                                {activeFilters > 0 ? ' match these filters' : ' registered'}
                                {users?.last_page > 1 && (
                                    <span className="text-surface-400">
                                        {' '}&middot; page {users.current_page} of {users.last_page}
                                    </span>
                                )}
                            </p>
                        </div>
                        <Link href="/admin/users/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-user-add mr-1.5" />
                            New User
                        </Link>
                    </div>

                    {/* Filters: one box for anything typed, plus the two things
                        people actually narrow by — which section, which role. */}
                    <div className="card-body border-b border-surface-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="lg:col-span-2 relative">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                            <input
                                className="form-input !pl-9"
                                placeholder="Name, email, designation, section or role…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && go({ search })}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={filters.section_id ?? ''}
                            onChange={(e) => go({ section_id: e.target.value })}
                        >
                            <option value="">All sections</option>
                            <option value="none">— Not assigned —</option>
                            {sections.map((sec: any) => (
                                <option key={sec.id} value={sec.id}>
                                    {sec.parent_id
                                        ? `\u00A0\u00A0\u00A0↳ ${sec.name} — under ${sec.parent_name}`
                                        : `${sec.name}${sec.code ? ` (${sec.code})` : ''}`}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={filters.role ?? ''}
                            onChange={(e) => go({ role: e.target.value })}
                        >
                            <option value="">All roles</option>
                            {roles.map((r: string) => (
                                <option key={r} value={r}>{r.replace(/-/g, ' ')}</option>
                            ))}
                        </select>

                        <div className="flex items-center gap-2">
                            <select
                                className="form-select flex-1"
                                value={filters.status ?? ''}
                                onChange={(e) => go({ status: e.target.value })}
                            >
                                <option value="">Active &amp; inactive</option>
                                <option value="active">Active only</option>
                                <option value="inactive">Inactive only</option>
                            </select>
                            {activeFilters > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="btn-ghost btn-sm shrink-0"
                                    title="Clear filters"
                                >
                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        {rows.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-users text-2xl" />
                                </div>
                                <div className="empty-state-title">No users found</div>
                                <div className="empty-state-text">
                                    {activeFilters > 0
                                        ? 'Nobody matches these filters — clear them to see everyone.'
                                        : 'Get started by creating the first user account.'}
                                </div>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-12 text-right">Sl</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Section</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((user: any, i: number) => (
                                        <tr key={user.id}>
                                            {/* The paginator's own `from` is the serial of its first
                                                row, so the numbering runs on across the pages
                                                instead of restarting at 1 on page 2. */}
                                            <td className="text-right text-xs text-surface-400 tabular-nums">
                                                {(users?.from ?? 1) + i}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                        {user.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block font-semibold text-surface-900">{user.name}</span>
                                                        {user.designation && (
                                                            <span className="text-[11px] text-surface-400">{user.designation}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-surface-600">{user.email}</td>
                                            <td>
                                                {user.section ? (
                                                    <>
                                                        <span className="text-surface-700">{user.section.name}</span>
                                                        {/* A bench and the shop it sits in are
                                                            different postings — say which. */}
                                                        {user.section.parent_name && (
                                                            <span className="block text-[10px] text-surface-400">
                                                                ↳ under {user.section.parent_name}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-surface-300">—</span>
                                                )}
                                            </td>
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
                                                    {user.can_delete && (
                                                        <button
                                                            onClick={() => destroy(user)}
                                                            className="btn-ghost btn-xs !text-rose-600 hover:!bg-rose-50"
                                                            title="Delete this account (it has no work against it)"
                                                        >
                                                            <i className="fi fi-rr-trash leading-none" />
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
                                <div className="empty-state-text">
                                    {activeFilters > 0
                                        ? 'Nobody matches these filters — clear them to see everyone.'
                                        : 'Get started by creating the first user account.'}
                                </div>
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
                                            {user.section && (
                                                <div className="text-[11px] text-surface-400 truncate">
                                                    {user.section.name}
                                                    {user.section.parent_name && ` — under ${user.section.parent_name}`}
                                                </div>
                                            )}
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
                                        {user.can_delete && (
                                            <button
                                                onClick={() => destroy(user)}
                                                className="btn-ghost btn-xs !text-rose-600 hover:!bg-rose-50"
                                                title="Delete this account (it has no work against it)"
                                            >
                                                <i className="fi fi-rr-trash leading-none" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* There were no pagination links at all, so everyone past the
                    first page was simply unreachable. */}
                {users?.links && users.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {users.links.map((link: any, i: number) => (
                            link.url ? (
                                <Link
                                    key={i}
                                    href={link.url}
                                    preserveScroll
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${link.active
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 text-xs text-surface-300"
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            )
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
