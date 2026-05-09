import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function Register() {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Create Account" />
            <div className="min-h-[100dvh] flex">

                {/* Left: Branding Panel */}
                <div
                    className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${theme.sidebar_color || '#0f172a'}, ${theme.sidebar_accent || '#1e293b'})` }}
                >
                    <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-5 bg-white" />
                    <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-5 bg-white" />
                    <div className="absolute top-1/4 right-10 w-32 h-32 rounded-2xl opacity-5 bg-white rotate-12" />

                    <div className="relative z-10 flex flex-col justify-between p-12 w-full">
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

                        <div className="space-y-6">
                            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                                Join the modern<br />
                                <span className="text-brand-400">manufacturing platform</span>
                            </h1>
                            <p className="text-white/50 text-sm leading-relaxed max-w-sm">
                                Create your account to start managing RFQs, quotations, work orders, and production tracking in one unified system.
                            </p>
                            <div className="flex gap-6 pt-2">
                                {[
                                    { icon: 'fi-rr-rocket-lunch', label: 'Quick Setup' },
                                    { icon: 'fi-rr-shield-check', label: 'Enterprise Grade' },
                                    { icon: 'fi-rr-headset', label: '24/7 Support' },
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

                        <div className="text-xs text-white/30">
                            Bangladesh Industrial Technical Assistance Centre
                        </div>
                    </div>
                </div>

                {/* Right: Register Form */}
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

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-surface-900">Create your account</h2>
                            <p className="text-sm text-surface-500 mt-1">Get started in a few easy steps</p>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label htmlFor="name" className="block text-sm font-semibold text-surface-700">
                                    Full name
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <i className="fi fi-rr-user text-surface-400 text-sm leading-none" />
                                    </div>
                                    <input
                                        id="name"
                                        type="text"
                                        value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-400
                                                   focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                                                   transition-all"
                                        placeholder="John Doe"
                                        autoComplete="name"
                                        autoFocus
                                        required
                                    />
                                </div>
                                {errors.name && (
                                    <p className="text-red-600 text-xs font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-exclamation text-[10px] leading-none" />{errors.name}
                                    </p>
                                )}
                            </div>

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
                                <label htmlFor="password" className="block text-sm font-semibold text-surface-700">
                                    Password
                                </label>
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
                                        placeholder="Create a strong password"
                                        autoComplete="new-password"
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

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label htmlFor="password_confirmation" className="block text-sm font-semibold text-surface-700">
                                    Confirm password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <i className="fi fi-rr-lock text-surface-400 text-sm leading-none" />
                                    </div>
                                    <input
                                        id="password_confirmation"
                                        type={showConfirm ? 'text' : 'password'}
                                        value={data.password_confirmation}
                                        onChange={e => setData('password_confirmation', e.target.value)}
                                        className="w-full pl-10 pr-11 py-3 rounded-xl border border-surface-200 bg-white text-sm
                                                   placeholder:text-surface-400
                                                   focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                                                   transition-all"
                                        placeholder="Repeat your password"
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-600 transition-colors"
                                    >
                                        <i className={`fi ${showConfirm ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                                    </button>
                                </div>
                                {errors.password_confirmation && (
                                    <p className="text-red-600 text-xs font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-exclamation text-[10px] leading-none" />{errors.password_confirmation}
                                    </p>
                                )}
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
                                    <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Creating account...</>
                                ) : (
                                    <><i className="fi fi-rr-user-add text-sm leading-none" /> Create Account</>
                                )}
                            </button>
                        </form>

                        {/* Sign-in link */}
                        <div className="mt-8 pt-6 border-t border-surface-200 text-center">
                            <p className="text-xs text-surface-400">Already have an account?</p>
                            <Link href={route('login')} className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                                Sign in instead <span className="ml-0.5">&rarr;</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
