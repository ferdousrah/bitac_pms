import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}: {
    mustVerifyEmail: boolean;
    status?: string;
    className?: string;
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <form onSubmit={submit} className={`space-y-5 max-w-xl ${className}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                    <label htmlFor="name" className="form-label">Full name *</label>
                    <input
                        id="name"
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className="form-input"
                        autoComplete="name"
                        autoFocus
                        required
                    />
                    {errors.name && <p className="form-error">{errors.name}</p>}
                </div>

                <div className="form-group">
                    <label htmlFor="email" className="form-label">Email address *</label>
                    <input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="form-input"
                        autoComplete="username"
                        required
                    />
                    {errors.email && <p className="form-error">{errors.email}</p>}
                </div>
            </div>

            {mustVerifyEmail && user.email_verified_at === null && (
                <div className="alert alert-warning">
                    <i className="fi fi-rr-triangle-warning leading-none shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">Your email address is unverified.</p>
                        <Link
                            href={route('verification.send')}
                            method="post"
                            as="button"
                            className="mt-1 text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                        >
                            Click here to re-send the verification email
                        </Link>
                        {status === 'verification-link-sent' && (
                            <p className="mt-2 text-xs font-medium text-emerald-600">
                                A new verification link has been sent to your email address.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={processing} className="btn-primary">
                    {processing ? (
                        <><i className="fi fi-rr-spinner animate-spin" /> Saving...</>
                    ) : (
                        <><i className="fi fi-rr-disk" /> Save changes</>
                    )}
                </button>

                <Transition
                    show={recentlySuccessful}
                    enter="transition ease-in-out"
                    enterFrom="opacity-0"
                    leave="transition ease-in-out"
                    leaveTo="opacity-0"
                >
                    <p className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                        <i className="fi fi-rr-check-circle leading-none" /> Saved
                    </p>
                </Transition>
            </div>
        </form>
    );
}
