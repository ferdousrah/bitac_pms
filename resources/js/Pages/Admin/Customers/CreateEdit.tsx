import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function CustomerCreateEdit({ customer }: any) {
    const { data, setData, post, put, errors, processing } = useForm({
        name: customer?.name ?? '',
        contact_person: customer?.contact_person ?? '',
        email: customer?.email ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        is_active: customer?.is_active ?? true,
        reset_password: false as boolean,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (customer) {
            put(`/admin/customers/${customer.id}`);
        } else {
            post('/admin/customers');
        }
    };

    return (
        <AppLayout header={customer ? 'Edit Customer Account' : 'New Customer Account'}>
            <div className="max-w-2xl animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                                <i className={`fi fi-rr-${customer ? 'pencil' : 'building'} text-lg`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">
                                    {customer ? 'Edit Customer Account' : 'New Customer Account'}
                                </h2>
                                <p className="text-sm text-surface-500">
                                    {customer ? 'Update customer organisation details' : 'Create a new customer portal account'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card-body">
                        <form onSubmit={submit} className="space-y-5">
                            <div className="form-group">
                                <label className="form-label">
                                    Organisation Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData('name', e.target.value)}
                                    className="form-input"
                                    placeholder="Enter organisation name"
                                    required
                                />
                                {errors.name && <p className="form-error">{errors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">
                                        Contact Person <span className="form-label-optional">Optional</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.contact_person}
                                        onChange={e => setData('contact_person', e.target.value)}
                                        className="form-input"
                                        placeholder="Primary contact name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Phone <span className="form-label-optional">Optional</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.phone}
                                        onChange={e => setData('phone', e.target.value)}
                                        className="form-input"
                                        placeholder="Phone number"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Email (login) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={e => setData('email', e.target.value)}
                                    className="form-input"
                                    placeholder="customer@company.com"
                                    required
                                />
                                {errors.email && <p className="form-error">{errors.email}</p>}
                            </div>

                            {/* Password — auto-generated on create, optional reset on edit */}
                            {!customer ? (
                                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                                    <i className="fi fi-rr-shield-check text-blue-500 text-base leading-none mt-0.5 shrink-0" />
                                    <div className="text-xs text-blue-900/80 leading-relaxed">
                                        <strong className="font-semibold text-blue-900">Auto-generated password.</strong> A secure temporary password will be created and emailed to the customer on save. They'll be required to set a new password on first sign-in.
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200">
                                    <input
                                        type="checkbox"
                                        id="reset_password"
                                        checked={Boolean(data.reset_password)}
                                        onChange={e => setData('reset_password', e.target.checked)}
                                        className="rounded border-surface-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="reset_password" className="text-sm font-medium text-surface-700 select-none cursor-pointer">
                                        Reset password and email new credentials
                                    </label>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">
                                    Address <span className="form-label-optional">Optional</span>
                                </label>
                                <textarea
                                    value={data.address}
                                    onChange={e => setData('address', e.target.value)}
                                    rows={2}
                                    className="form-textarea"
                                    placeholder="Organisation address"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={Boolean(data.is_active)}
                                    onChange={e => setData('is_active', e.target.checked)}
                                    className="rounded border-surface-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-surface-700 select-none">
                                    Account Active
                                </label>
                                <span className="text-xs text-surface-400">Customer can log in when active</span>
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
                                            <i className={`fi fi-rr-${customer ? 'check' : 'plus'} mr-1.5`} />
                                            {customer ? 'Update Account' : 'Create & Email Credentials'}
                                        </>
                                    )}
                                </button>
                                <Link href="/admin/customers" className="btn-ghost">
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
