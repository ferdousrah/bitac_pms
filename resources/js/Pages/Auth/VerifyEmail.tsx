import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function VerifyEmail({ status }: { status?: string }) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;

    const { post, processing } = useForm({});

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <>
            <Head title="Email Verification" />
            <div className="min-h-[100dvh] flex items-center justify-center bg-surface-50 px-4 py-10">
                <div className="w-full max-w-md animate-fade-in">

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

                    <div className="card animate-slide-up">
                        <div className="card-body p-8">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-envelope-open text-blue-500 text-base leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-surface-900">Verify your email</h2>
                                    <p className="text-xs text-surface-500">One more step to get started</p>
                                </div>
                            </div>

                            <p className="text-sm text-surface-500 leading-relaxed mb-5">
                                Thanks for signing up! Before getting started, please verify your email address by clicking the link we just sent. If you didn't receive it, we'll gladly send another.
                            </p>

                            {status === 'verification-link-sent' && (
                                <div className="alert alert-success mb-5">
                                    <i className="fi fi-rr-check-circle leading-none" />
                                    <span>A new verification link has been sent to your email address.</span>
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-4">
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
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Sending...</>
                                    ) : (
                                        <><i className="fi fi-rr-paper-plane text-sm leading-none" /> Resend verification email</>
                                    )}
                                </button>

                                <Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                    className="w-full py-3 rounded-xl text-sm font-semibold text-surface-600 bg-white border border-surface-200 hover:bg-surface-50 hover:text-surface-900 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="fi fi-rr-sign-out-alt text-sm leading-none" /> Log out
                                </Link>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
