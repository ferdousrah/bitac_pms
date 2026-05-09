import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';

export default function ConfirmPassword() {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="Confirm Password" />
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
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-shield-exclamation text-amber-500 text-base leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-surface-900">Secure area</h2>
                                    <p className="text-xs text-surface-500">Password confirmation required</p>
                                </div>
                            </div>

                            <p className="text-sm text-surface-500 leading-relaxed mb-5">
                                This is a secure area of the application. Please confirm your password before continuing.
                            </p>

                            <form onSubmit={submit} className="space-y-5">
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
                                            placeholder="Enter your password"
                                            autoComplete="current-password"
                                            autoFocus
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
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Confirming...</>
                                    ) : (
                                        <><i className="fi fi-rr-shield-check text-sm leading-none" /> Confirm</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
