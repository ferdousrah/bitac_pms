import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useRef, useState } from 'react';

export default function UpdatePasswordForm({
    className = '',
}: {
    className?: string;
}) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }
                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    const renderPasswordInput = (
        id: string,
        label: string,
        value: string,
        onChange: (v: string) => void,
        error: string | undefined,
        visible: boolean,
        toggle: () => void,
        ref?: React.RefObject<HTMLInputElement>,
        autoComplete: string = 'new-password',
    ) => (
        <div className="form-group">
            <label htmlFor={id} className="form-label">{label} *</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fi fi-rr-lock text-surface-400 text-sm leading-none" />
                </div>
                <input
                    id={id}
                    ref={ref}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="form-input !pl-9 !pr-10"
                    autoComplete={autoComplete}
                />
                <button
                    type="button"
                    onClick={toggle}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 transition-colors"
                >
                    <i className={`fi ${visible ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                </button>
            </div>
            {error && <p className="form-error">{error}</p>}
        </div>
    );

    return (
        <form onSubmit={updatePassword} className={`space-y-5 max-w-xl ${className}`}>
            {renderPasswordInput(
                'current_password',
                'Current password',
                data.current_password,
                v => setData('current_password', v),
                errors.current_password,
                showCurrent,
                () => setShowCurrent(s => !s),
                currentPasswordInput,
                'current-password',
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderPasswordInput(
                    'password',
                    'New password',
                    data.password,
                    v => setData('password', v),
                    errors.password,
                    showNew,
                    () => setShowNew(s => !s),
                    passwordInput,
                )}

                {renderPasswordInput(
                    'password_confirmation',
                    'Confirm password',
                    data.password_confirmation,
                    v => setData('password_confirmation', v),
                    errors.password_confirmation,
                    showConfirm,
                    () => setShowConfirm(s => !s),
                )}
            </div>

            <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={processing} className="btn-primary">
                    {processing ? (
                        <><i className="fi fi-rr-spinner animate-spin" /> Updating...</>
                    ) : (
                        <><i className="fi fi-rr-shield-check" /> Update password</>
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
