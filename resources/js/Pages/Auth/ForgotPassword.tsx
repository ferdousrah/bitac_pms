import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function ForgotPassword({ status }: { status?: string }) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;

    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <>
            <Head title="Forgot Password" />
            <div className="min-h-[100dvh] flex items-center justify-center bg-surface-50 px-4 py-10">
                <div className="w-full max-w-md animate-fade-in">

                    {/* Brand header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-3">
                            {theme.logo_url ? (
                                <img src={theme.logo_url} className="w-14 h-14 rounded-2xl object-cover shadow-lg" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                                    <i className="fi fi-sr-industry-windows text-white text-xl leading-none" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-xl font-bold text-surface-900">{theme.brand_name || 'BITAC PMS'}</h1>
                        <p className="text-xs text-surface-400 mt-0.5">{theme.brand_subtitle || 'Production Management'}</p>
                    </div>

                    {/* Card */}
                    <div className="card animate-slide-up">
                        <div className="card-body p-8">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-key text-brand-500 text-base leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-surface-900">Forgot password?</h2>
                                    <p className="text-xs text-surface-500">We'll email you a reset link</p>
                                </div>
                            </div>

                            <p className="text-sm text-surface-500 leading-relaxed mb-5">
                                No problem. Enter the email associated with your account and we'll send you a link to reset your password.
                            </p>

                            {status && (
                                <div className="alert alert-success mb-5">
                                    <i className="fi fi-rr-check-circle leading-none" />
                                    <span>{status}</span>
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-5">
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
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Sending link...</>
                                    ) : (
                                        <><i className="fi fi-rr-paper-plane text-sm leading-none" /> Email password reset link</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="mt-6 text-center">
                        <Link
                            href={route('login')}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors"
                        >
                            <i className="fi fi-rr-arrow-left text-xs leading-none" />
                            Back to login
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
