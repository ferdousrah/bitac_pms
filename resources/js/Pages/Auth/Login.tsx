import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <>
            <Head title="Sign In" />
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
                    <Link href="/customer/login"
                        className="text-xs font-medium text-surface-500 hover:text-surface-900 transition-colors">
                        Customer portal <span aria-hidden>&rarr;</span>
                    </Link>
                </header>

                {/* Centered card */}
                <main className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-[380px]">

                        {/* Heading */}
                        <div className="mb-9">
                            <h1 className="text-[28px] leading-tight font-semibold text-surface-900 tracking-tight">
                                Sign in
                            </h1>
                            <p className="text-sm text-surface-500 mt-1.5">
                                Welcome back. Continue to your workspace.
                            </p>
                        </div>

                        {/* Status banner */}
                        {status && (
                            <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 flex items-center gap-2">
                                <i className="fi fi-rr-check-circle text-sm leading-none shrink-0" />
                                <span>{status}</span>
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-xs font-medium text-surface-600 mb-1.5">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={e => setData('email', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-sm
                                               placeholder:text-surface-300
                                               focus:outline-none focus:border-surface-900 focus:ring-0
                                               transition-colors"
                                    placeholder="you@company.com"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                                {errors.email && (
                                    <p className="mt-1.5 text-[11px] text-red-600">{errors.email}</p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="password" className="block text-xs font-medium text-surface-600">
                                        Password
                                    </label>
                                    {canResetPassword && (
                                        <Link href={route('password.request')}
                                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 transition-colors">
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={e => setData('password', e.target.value)}
                                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-300
                                                   focus:outline-none focus:border-surface-900 focus:ring-0
                                                   transition-colors"
                                        placeholder="Enter password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-700 transition-colors"
                                        tabIndex={-1}
                                    >
                                        <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-xs leading-none`} />
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1.5 text-[11px] text-red-600">{errors.password}</p>
                                )}
                            </div>

                            {/* Remember */}
                            <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                                <input
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={e => setData('remember', e.target.checked as any)}
                                    className="w-3.5 h-3.5 rounded border-surface-300 text-surface-900 focus:ring-0 focus:ring-offset-0"
                                />
                                <span className="text-xs text-surface-600">Keep me signed in</span>
                            </label>

                            {/* Submit */}
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
                                    <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Signing in</>
                                ) : (
                                    <>Sign in <span aria-hidden>&rarr;</span></>
                                )}
                            </button>
                        </form>
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
