import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';

export default function CustomersIndex({ customers }: any) {
    return (
        <AppLayout header="Customer Portal Accounts">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-surface-900">Customer Accounts</h2>
                            <p className="text-sm text-surface-500 mt-0.5">
                                {customers.length} account{customers.length !== 1 && 's'} registered
                            </p>
                        </div>
                        <Link href="/admin/customers/create" className="btn-primary btn-sm">
                            <i className="fi fi-rr-building mr-1.5" />
                            New Customer Account
                        </Link>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        {customers.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-building text-2xl" />
                                </div>
                                <div className="empty-state-title">No customer accounts yet</div>
                                <div className="empty-state-text">Create a customer account to give them portal access.</div>
                            </div>
                        ) : (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Organisation</th>
                                        <th>Contact Person</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((c: any) => (
                                        <tr key={c.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                        {c.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-surface-900">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-surface-600">{c.contact_person ?? '—'}</td>
                                            <td className="text-surface-600">{c.email}</td>
                                            <td className="text-surface-600">{c.phone ?? '—'}</td>
                                            <td>
                                                <span className={c.is_active ? 'badge badge-green' : 'badge badge-red'}>
                                                    <i className={`fi fi-sr-${c.is_active ? 'check-circle' : 'cross-circle'} mr-1 text-[10px]`} />
                                                    {c.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex justify-end">
                                                    <Link href={`/admin/customers/${c.id}/edit`} className="btn-outline btn-xs">
                                                        <i className="fi fi-rr-pencil mr-1" />
                                                        Edit
                                                    </Link>
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
                        {customers.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-building text-2xl" />
                                </div>
                                <div className="empty-state-title">No customer accounts yet</div>
                                <div className="empty-state-text">Create a customer account to give them portal access.</div>
                            </div>
                        ) : (
                            customers.map((c: any) => (
                                <div key={c.id} className="rounded-xl border border-surface-200 p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                            {c.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-surface-900 truncate">{c.name}</div>
                                            <div className="text-sm text-surface-500 truncate">{c.email}</div>
                                        </div>
                                        <span className={c.is_active ? 'badge badge-green' : 'badge badge-red'}>
                                            {c.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-surface-400 text-xs">Contact</span>
                                            <div className="text-surface-700">{c.contact_person ?? '—'}</div>
                                        </div>
                                        <div>
                                            <span className="text-surface-400 text-xs">Phone</span>
                                            <div className="text-surface-700">{c.phone ?? '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-surface-100">
                                        <Link href={`/admin/customers/${c.id}/edit`} className="btn-outline btn-xs">
                                            <i className="fi fi-rr-pencil mr-1" />
                                            Edit
                                        </Link>
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
