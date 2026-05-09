import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

interface PermissionItem { name: string; label: string }
interface PermissionGroup { group: string; permissions: PermissionItem[] }

interface Props {
    role: { id: number; name: string } | null;
    grouped_permissions: PermissionGroup[];
    assigned: string[];
}

export default function RoleCreateEdit({ role, grouped_permissions, assigned }: Props) {
    const isEdit = !!role;
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const { data, setData, post, put, processing, errors } = useForm({
        name: role?.name ?? '',
        permissions: assigned ?? [],
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            put(`/admin/roles/${role!.id}`);
        } else {
            post('/admin/roles');
        }
    };

    const togglePermission = (perm: string) => {
        setData('permissions',
            data.permissions.includes(perm)
                ? data.permissions.filter(p => p !== perm)
                : [...data.permissions, perm]
        );
    };

    const toggleGroupAll = (group: PermissionGroup) => {
        const groupPerms = group.permissions.map(p => p.name);
        const allSelected = groupPerms.every(p => data.permissions.includes(p));
        if (allSelected) {
            setData('permissions', data.permissions.filter(p => !groupPerms.includes(p)));
        } else {
            setData('permissions', Array.from(new Set([...data.permissions, ...groupPerms])));
        }
    };

    const selectAll = () => {
        const all = grouped_permissions.flatMap(g => g.permissions.map(p => p.name));
        setData('permissions', all);
    };
    const clearAll = () => setData('permissions', []);

    const totalPerms = useMemo(
        () => grouped_permissions.reduce((s, g) => s + g.permissions.length, 0),
        [grouped_permissions]
    );

    // Filter groups by search query
    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return grouped_permissions;
        return grouped_permissions
            .map(g => ({
                ...g,
                permissions: g.permissions.filter(p =>
                    p.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)
                ),
            }))
            .filter(g => g.permissions.length > 0);
    }, [grouped_permissions, search]);

    return (
        <AppLayout header={isEdit ? 'Edit Role' : 'New Role'}>
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in max-w-6xl mx-auto">

                {/* Page header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{isEdit ? `Edit Role: ${role!.name}` : 'Create New Role'}</h1>
                        <p className="page-subtitle">Define a role and select the permissions it should grant</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/roles" className="btn-outline">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                        </Link>
                        <button type="submit" disabled={processing} className="btn-primary">
                            <i className="fi fi-rr-disk text-xs leading-none" />
                            {processing ? 'Saving…' : isEdit ? 'Update Role' : 'Create Role'}
                        </button>
                    </div>
                </div>

                {/* Role name + summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                        <div className="card-header">
                            <h2 className="text-sm font-bold text-surface-800">Role Details</h2>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Role Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData('name', e.target.value)}
                                    placeholder="e.g. shift-supervisor"
                                    className="form-input"
                                    autoFocus
                                />
                                <p className="form-hint">
                                    Use lowercase letters, numbers, hyphens or underscores. This identifier will be used internally.
                                </p>
                                {errors.name && <p className="form-error">{errors.name}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="card relative overflow-hidden transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-brand-100/40 blur-3xl pointer-events-none" />
                        <div className="card-header">
                            <h2 className="text-sm font-bold text-surface-800">Coverage Summary</h2>
                        </div>
                        <div className="card-body relative">
                            <div className="flex items-end gap-2 mb-3">
                                <div className="text-4xl font-bold text-brand-600 tabular-nums leading-none">{data.permissions.length}</div>
                                <div className="text-sm text-surface-500 mb-1">/ {totalPerms} permissions</div>
                            </div>
                            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                                    style={{ width: `${totalPerms > 0 ? (data.permissions.length / totalPerms) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <button type="button" onClick={selectAll} className="btn-ghost btn-xs flex-1 justify-center">
                                    <i className="fi fi-rr-check-double text-xs leading-none" /> Select all
                                </button>
                                <button type="button" onClick={clearAll} className="btn-ghost btn-xs flex-1 justify-center text-red-600 hover:bg-red-50">
                                    <i className="fi fi-rr-cross-small text-xs leading-none" /> Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Permissions matrix */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-key leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-800">Permissions</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Grouped by module — toggle individually or by group</p>
                            </div>
                        </div>
                        <div className="relative">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search permissions…"
                                className="form-input !pl-8 !py-1.5 text-xs w-48"
                            />
                        </div>
                    </div>
                    <div className="card-body">
                        {errors.permissions && <p className="form-error mb-3">{errors.permissions}</p>}

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredGroups.map(group => {
                                const groupPerms = group.permissions.map(p => p.name);
                                const selectedCount = groupPerms.filter(p => data.permissions.includes(p)).length;
                                const allSelected  = selectedCount === groupPerms.length;
                                const someSelected = selectedCount > 0 && !allSelected;
                                const isCollapsed  = !!collapsed[group.group];

                                return (
                                    <div key={group.group}
                                         className={`rounded-xl border bg-surface-50/50 overflow-hidden transition-all
                                            ${allSelected ? 'border-brand-300 ring-1 ring-brand-200' :
                                              someSelected ? 'border-brand-200' : 'border-surface-200'}`}>

                                        {/* Group header */}
                                        <button
                                            type="button"
                                            onClick={() => setCollapsed(c => ({ ...c, [group.group]: !isCollapsed }))}
                                            className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                                    allSelected ? 'bg-brand-500 text-white' :
                                                    someSelected ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-600'
                                                }`}>
                                                    {selectedCount}/{groupPerms.length}
                                                </div>
                                                <span className="font-bold text-xs text-surface-800 uppercase tracking-wide truncate">{group.group}</span>
                                            </div>
                                            <i className={`fi fi-rr-angle-small-down text-surface-400 text-xs transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                        </button>

                                        {/* Group select-all + permissions */}
                                        {!isCollapsed && (
                                            <div className="px-3.5 pb-3 border-t border-surface-200/70 bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroupAll(group)}
                                                    className="w-full text-[10px] font-bold uppercase tracking-wider py-1.5 mt-1 mb-2 rounded text-brand-600 hover:bg-brand-50"
                                                >
                                                    {allSelected ? '✕ Deselect all' : '✓ Select all in group'}
                                                </button>
                                                <div className="space-y-1">
                                                    {group.permissions.map(perm => {
                                                        const checked = data.permissions.includes(perm.name);
                                                        return (
                                                            <label key={perm.name}
                                                                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                                                                    ${checked ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-surface-50'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => togglePermission(perm.name)}
                                                                    className="rounded border-surface-300 text-brand-500 focus:ring-brand-400 focus:ring-2 focus:ring-offset-0 cursor-pointer"
                                                                />
                                                                <span className={`text-xs flex-1 truncate ${checked ? 'text-surface-900 font-medium' : 'text-surface-600'}`}>
                                                                    {perm.name}
                                                                </span>
                                                                {checked && (
                                                                    <i className="fi fi-rr-check text-brand-500 text-[10px] leading-none" />
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {filteredGroups.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-search" /></div>
                                <p className="empty-state-title">No permissions match "{search}"</p>
                                <p className="empty-state-text">Try a different search term.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom action bar */}
                <div className="flex items-center justify-end gap-2 sticky bottom-4 z-20">
                    <Link href="/admin/roles" className="btn-outline shadow-premium">
                        Cancel
                    </Link>
                    <button type="submit" disabled={processing} className="btn-primary shadow-premium">
                        <i className="fi fi-rr-disk text-xs leading-none" />
                        {processing ? 'Saving…' : isEdit ? 'Update Role' : 'Create Role'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
