import Modal from '@/Components/Modal';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useRef, useState } from 'react';

export default function DeleteUserForm({
    className = '',
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="alert alert-error">
                <i className="fi fi-rr-triangle-warning leading-none shrink-0" />
                <div>
                    <p className="text-sm font-semibold">This action cannot be undone</p>
                    <p className="text-xs mt-0.5 opacity-90">
                        Once your account is deleted, all of its resources and data will be permanently removed.
                        Before deleting, please download any data you wish to retain.
                    </p>
                </div>
            </div>

            <button type="button" onClick={confirmUserDeletion} className="btn-danger">
                <i className="fi fi-rr-trash" /> Delete account
            </button>

            <Modal show={confirmingUserDeletion} onClose={closeModal} maxWidth="lg">
                <form onSubmit={deleteUser}>
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-surface-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-triangle-warning text-red-500 text-base leading-none" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-base font-bold text-surface-900">
                                    Delete your account?
                                </h2>
                                <p className="mt-1 text-xs text-surface-500 leading-relaxed">
                                    Once your account is deleted, all of its resources and data will be
                                    permanently deleted. Enter your password to confirm you would like to
                                    permanently delete your account.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5">
                        <div className="form-group">
                            <label htmlFor="delete_password" className="form-label">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="fi fi-rr-lock text-surface-400 text-sm leading-none" />
                                </div>
                                <input
                                    id="delete_password"
                                    ref={passwordInput}
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="form-input !pl-9 !pr-10"
                                    placeholder="Enter your password to confirm"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 transition-colors"
                                >
                                    <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                                </button>
                            </div>
                            {errors.password && <p className="form-error">{errors.password}</p>}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2">
                        <button type="button" onClick={closeModal} className="btn-outline">
                            Cancel
                        </button>
                        <button type="submit" disabled={processing} className="btn-danger">
                            {processing ? (
                                <><i className="fi fi-rr-spinner animate-spin" /> Deleting...</>
                            ) : (
                                <><i className="fi fi-rr-trash" /> Delete account</>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
