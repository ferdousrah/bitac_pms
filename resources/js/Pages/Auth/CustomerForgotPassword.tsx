import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function CustomerForgotPassword({ status }: { status?: string }) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;

    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/customer/password/forgot');
    };

    return (
        <>
            <Head title="Customer Portal — Reset password" />
            <div className="min-h-[100dvh] flex flex-col bg-white">

                <div className="pointer-events-none fixed inset-0 -z-10">
                    <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-500/[0.04] blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-brand-500/[0.03] blur-3xl" />
                </div>

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
                        Back to sign in <span aria-hidden>&rarr;</span>
                    </Link>
                </header>

                <main className="flex-1 flex items-center justify-center px-6 py-10">
                    <div className="w-full max-w-[380px]">

                        <div className="mb-9">
                            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-[11px] font-medium border border-brand-100">
                                <i className="fi fi-rr-building text-[10px] leading-none" />
                                Customer Portal
                            </div>
                            <h1 className="text-[28px] leading-tight font-semibold text-surface-900 tracking-tight">
                                Reset password
                            </h1>
                            <p className="text-sm text-surface-500 mt-1.5">
                                Enter your email and we'll send you a link to set a new password.
                            </p>
                        </div>

                        {status && (
                            <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 flex items-center gap-2">
                                <i className="fi fi-rr-check-circle text-sm leading-none shrink-0" />
                                <span>{status}</span>
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-4">
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
                                    placeholder="your@company.com"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                                {errors.email && (
                                    <p className="mt-1.5 text-[11px] text-red-600">{errors.email}</p>
                                )}
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
                                    <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Sending</>
                                ) : (
                                    <>Send reset link <span aria-hidden>&rarr;</span></>
                                )}
                            </button>
                        </form>

                        <div className="mt-6">
                            <Link
                                href="/customer/login"
                                className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-900 transition-colors"
                            >
                                <span aria-hidden>&larr;</span> Back to sign in
                            </Link>
                        </div>
                    </div>
                </main>

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
