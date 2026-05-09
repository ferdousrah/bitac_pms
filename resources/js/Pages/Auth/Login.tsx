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

    // Apply theme on this page too
    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <>
            <Head title="Sign In" />
            <div className="min-h-[100dvh] flex">

                {/* ── Left: Branding Panel ─────────────────────────── */}
                <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${theme.sidebar_color || '#0f172a'}, ${theme.sidebar_accent || '#1e293b'})` }}>
                    {/* Decorative circles */}
                    <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-5 bg-white" />
                    <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-5 bg-white" />
                    <div className="absolute top-1/4 right-10 w-32 h-32 rounded-2xl opacity-5 bg-white rotate-12" />

                    <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            {theme.logo_url ? (
                                <img src={theme.logo_url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                                    <i className="fi fi-sr-industry-windows text-white text-base leading-none" />
                                </div>
                            )}
                            <div>
                                <div className="text-lg font-bold text-white">{theme.brand_name || 'BITAC PMS'}</div>
                                <div className="text-xs text-white/40">{theme.brand_subtitle || 'Production Management'}</div>
                            </div>
                        </div>

                        {/* Center content */}
                        <div className="space-y-6">
                            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                                Streamline your<br />
                                <span className="text-brand-400">production workflow</span>
                            </h1>
                            <p className="text-white/50 text-sm leading-relaxed max-w-sm">
                                Manage RFQs, quotations, work orders, quality control, and delivery — all in one unified platform.
                            </p>
                            <div className="flex gap-6 pt-2">
                                {[
                                    { icon: 'fi-rr-shield-check', label: 'Quality First' },
                                    { icon: 'fi-rr-chart-tree', label: 'Real-time Tracking' },
                                    { icon: 'fi-rr-lock', label: 'Secure Access' },
                                ].map(f => (
                                    <div key={f.label} className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                            <i className={`fi ${f.icon} text-brand-400 text-xs leading-none`} />
                                        </div>
                                        <span className="text-xs text-white/60 font-medium">{f.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-xs text-white/30">
                            Bangladesh Industrial Technical Assistance Centre
                        </div>
                    </div>
                </div>

                {/* ── Right: Login Form ──────────────────────────────── */}
                <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-surface-50">
                    <div className="w-full max-w-sm">

                        {/* Mobile logo */}
                        <div className="lg:hidden text-center mb-10">
                            <div className="flex justify-center mb-3">
                                {theme.logo_url ? (
                                    <img src={theme.logo_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                                        <i className="fi fi-sr-industry-windows text-white text-lg leading-none" />
                                    </div>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-surface-900">{theme.brand_name || 'BITAC PMS'}</h2>
                            <p className="text-xs text-surface-400 mt-1">{theme.brand_subtitle || 'Production Management'}</p>
                        </div>

                        {/* Heading */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-surface-900">Welcome back</h2>
                            <p className="text-sm text-surface-500 mt-1">Sign in to your account to continue</p>
                        </div>

                        {/* Status message */}
                        {status && (
                            <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                                <i className="fi fi-rr-check-circle leading-none shrink-0" />
                                {status}
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-sm font-semibold text-surface-700">
                                    Email address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <i className="fi fi-rr-envelope text-surface-400 text-sm leading-none" />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-400
                                                   focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                                                   transition-all"
                                        placeholder="you@company.com"
                                        autoComplete="username"
                                        autoFocus
                                        required
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-600 text-xs font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-exclamation text-[10px] leading-none" />{errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="block text-sm font-semibold text-surface-700">
                                        Password
                                    </label>
                                    {canResetPassword && (
                                        <Link href={route('password.request')}
                                            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <i className="fi fi-rr-lock text-surface-400 text-sm leading-none" />
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={e => setData('password', e.target.value)}
                                        className="w-full pl-10 pr-11 py-3 rounded-xl border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-400
                                                   focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                                                   transition-all"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-600 transition-colors"
                                    >
                                        <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-600 text-xs font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-exclamation text-[10px] leading-none" />{errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Remember me */}
                            <div className="flex items-center gap-2.5">
                                <input
                                    id="remember"
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={e => setData('remember', e.target.checked as any)}
                                    className="w-4 h-4 rounded-md border-surface-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 transition-colors"
                                />
                                <label htmlFor="remember" className="text-sm text-surface-600 select-none">
                                    Keep me signed in
                                </label>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-3 rounded-xl text-sm font-semibold text-white
                                           bg-gradient-to-b from-brand-500 to-brand-600
                                           hover:from-brand-400 hover:to-brand-500 hover:shadow-glow
                                           focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                                           disabled:opacity-50 disabled:cursor-not-allowed
                                           active:scale-[0.98] transition-all duration-200
                                           flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in...</>
                                ) : (
                                    <><i className="fi fi-rr-sign-in-alt text-sm leading-none" /> Sign In</>
                                )}
                            </button>
                        </form>

                        {/* Customer portal link */}
                        <div className="mt-8 pt-6 border-t border-surface-200 text-center">
                            <p className="text-xs text-surface-400">Are you a customer?</p>
                            <Link href="/customer/login" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                                Customer Portal Login <span className="ml-0.5">&rarr;</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
