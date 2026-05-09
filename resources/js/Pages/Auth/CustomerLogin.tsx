import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function CustomerLogin() {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, errors, processing } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/customer/login');
    };

    return (
        <>
            <Head title="Customer Portal — Sign In" />
            <div className="min-h-[100dvh] flex flex-col justify-center items-center px-6 py-12 bg-surface-50">
                <div className="w-full max-w-sm">

                    {/* Logo / Branding */}
                    <div className="text-center mb-10">
                        <div className="flex justify-center mb-4">
                            {theme.logo_url ? (
                                <img src={theme.logo_url} className="w-14 h-14 rounded-2xl object-cover shadow-premium" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                                    <i className="fi fi-sr-industry-windows text-white text-xl leading-none" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-xl font-bold text-surface-900">{theme.brand_name || 'BITAC PMS'}</h1>
                        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold border border-brand-200">
                            <i className="fi fi-rr-building text-[10px] leading-none" />
                            Customer Portal
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-2xl border border-surface-100 shadow-premium p-6 sm:p-8">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-surface-900">Sign In</h2>
                            <p className="text-sm text-surface-500 mt-0.5">Access your orders and invoices</p>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-sm font-semibold text-surface-700">Email</label>
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
                                                   placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                                        placeholder="your@company.com"
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
                                <label htmlFor="password" className="block text-sm font-semibold text-surface-700">Password</label>
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
                                                   placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-600 transition-colors">
                                        <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-600 text-xs font-medium flex items-center gap-1">
                                        <i className="fi fi-rr-exclamation text-[10px] leading-none" />{errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Remember */}
                            <div className="flex items-center gap-2.5">
                                <input id="remember" type="checkbox" checked={data.remember}
                                    onChange={e => setData('remember', e.target.checked)}
                                    className="w-4 h-4 rounded-md border-surface-300 text-brand-600 focus:ring-brand-500 transition-colors" />
                                <label htmlFor="remember" className="text-sm text-surface-600 select-none">Keep me signed in</label>
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={processing}
                                className="w-full py-3 rounded-xl text-sm font-semibold text-white
                                           bg-gradient-to-b from-brand-500 to-brand-600
                                           hover:from-brand-400 hover:to-brand-500 hover:shadow-glow
                                           disabled:opacity-50 active:scale-[0.98] transition-all duration-200
                                           flex items-center justify-center gap-2">
                                {processing ? (
                                    <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in...</>
                                ) : (
                                    <><i className="fi fi-rr-sign-in-alt text-sm leading-none" /> Sign In</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Staff link */}
                    <div className="mt-8 text-center">
                        <p className="text-xs text-surface-400">BITAC staff member?</p>
                        <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
                            Staff Login <span className="ml-0.5">&rarr;</span>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
