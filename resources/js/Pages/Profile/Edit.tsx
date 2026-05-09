import AppLayout from '@/Layouts/AppLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AppLayout header="Profile Settings">
            <Head title="Profile" />

            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

                {/* Profile Information */}
                <div className="card animate-slide-up">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                <i className="fi fi-rr-user text-brand-500 text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Profile Information</h3>
                                <p className="text-xs text-surface-400">Update your account's profile information and email</p>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                        />
                    </div>
                </div>

                {/* Update Password */}
                <div className="card animate-slide-up">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                <i className="fi fi-rr-lock text-blue-500 text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Update Password</h3>
                                <p className="text-xs text-surface-400">Use a long, random password to stay secure</p>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <UpdatePasswordForm />
                    </div>
                </div>

                {/* Delete Account */}
                <div className="card animate-slide-up border-red-100">
                    <div className="card-header">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                                <i className="fi fi-rr-trash text-red-500 text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Delete Account</h3>
                                <p className="text-xs text-surface-400">Permanently delete your account and all of its data</p>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        <DeleteUserForm />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
