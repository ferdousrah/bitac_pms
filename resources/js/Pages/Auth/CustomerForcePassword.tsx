import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function CustomerForcePassword({ email }: { email: string }) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/customer/password/force');
    };

    return (
        <>
            <Head title="Set a new password" />
            <div className="min-h-[100dvh] flex flex-col bg-white">

                {/* Subtle ambient gradient */}
                <div className="pointer-events-none fixed inset-0 -z-10">
                    <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-500/[0.04] blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-brand-500/[0.03] blur-3xl" />
                </div>

                {/* Top bar */}
                <header className="flex items-center justify-between px-6 sm:px-10 py-5">
                    <div className="flex items-center gap-2.5">
                        {theme.logo_url ? (
                            <img src={theme.logo_url} className="w-8 h-8 object-contain" alt="" />
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                                <i className="fi fi-sr-industry-windows text-white text-xs leading-none" />
                            </div>
                        )}
                        <span className="text-sm font-semibold text-surface-900 tracking-tight">
                            {theme.brand_name || 'BITAC PMS'}
                        </span>
                    </div>
                    <a href="/customer/logout"
                        onClick={(e) => {
                            e.preventDefault();
                            const form = document.createElement('form');
                            form.method = 'POST';
                            form.action = '/customer/logout';
                            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                            if (token) {
                                const i = document.createElement('input');
                                i.type = 'hidden';
                                i.name = '_token';
                                i.value = token;
                                form.appendChild(i);
                            }
                            document.body.appendChild(form);
                            form.submit();
                        }}
                        className="text-xs font-medium text-surface-500 hover:text-surface-900 transition-colors">
                        Sign out <span aria-hidden>&rarr;</span>
                    </a>
                </header>

                {/* Centered form */}
                <main className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-[400px]">

                        {/* Heading */}
                        <div className="mb-8">
                            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full text-[11px] font-medium border border-amber-100">
                                <i className="fi fi-rr-shield-keyhole text-[10px] leading-none" />
                                One-time setup
                            </div>
                            <h1 className="text-[28px] leading-tight font-semibold text-surface-900 tracking-tight">
                                Set a new password
                            </h1>
                            <p className="text-sm text-surface-500 mt-1.5">
                                For your security, replace the temporary password sent to <span className="font-medium text-surface-700">{email}</span>.
                            </p>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            {/* Current (temp) password */}
                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                    Temporary password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? 'text' : 'password'}
                                        value={data.current_password}
                                        onChange={e => setData('current_password', e.target.value)}
                                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-300
                                                   focus:outline-none focus:border-surface-900 focus:ring-0
                                                   transition-colors"
                                        placeholder="From your welcome email"
                                        autoComplete="current-password"
                                        autoFocus
                                        required
                                    />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} tabIndex={-1}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-700 transition-colors">
                                        <i className={`fi ${showCurrent ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-xs leading-none`} />
                                    </button>
                                </div>
                                {errors.current_password && <p className="mt-1.5 text-[11px] text-red-600">{errors.current_password}</p>}
                            </div>

                            {/* New password */}
                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                    New password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={e => setData('password', e.target.value)}
                                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-300
                                                   focus:outline-none focus:border-surface-900 focus:ring-0
                                                   transition-colors"
                                        placeholder="At least 8 characters"
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} tabIndex={-1}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-700 transition-colors">
                                        <i className={`fi ${showNew ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-xs leading-none`} />
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1.5 text-[11px] text-red-600">{errors.password}</p>}
                            </div>

                            {/* Confirm */}
                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                    Confirm new password
                                </label>
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={data.password_confirmation}
                                    onChange={e => setData('password_confirmation', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-sm
                                               placeholder:text-surface-300
                                               focus:outline-none focus:border-surface-900 focus:ring-0
                                               transition-colors"
                                    placeholder="Re-enter new password"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-2.5 mt-2 rounded-lg text-sm font-medium text-white
                                           bg-surface-900 hover:bg-surface-800
                                           disabled:opacity-60 disabled:cursor-not-allowed
                                           active:scale-[0.99] transition-all duration-150
                                           flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Saving</>
                                ) : (
                                    <>Update password <span aria-hidden>&rarr;</span></>
                                )}
                            </button>
                        </form>

                        <p className="mt-6 text-[11px] text-surface-400 leading-relaxed">
                            Use at least 8 characters with a mix of letters and numbers. Avoid reusing passwords from other sites.
                        </p>
                    </div>
                </main>

                {/* Footer */}
                <footer className="px-6 sm:px-10 py-5 flex items-center justify-between text-[11px] text-surface-400">
                    <a href="https://technocratsbd.com" target="_blank" rel="noopener noreferrer"
                        className="hover:text-surface-700 transition-colors">
                        Developed by <span className="font-semibold">Technocrats</span>
                    </a>
                    <span className="hidden sm:inline">&copy; {new Date().getFullYear()}</span>
                </footer>
            </div>
        </>
    );
}
