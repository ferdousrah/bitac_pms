import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, ReactNode, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';
import { gearPath } from '@/Components/Public/Gear';

interface Bitac {
    name_bn?: string | null;
    ministry_bn?: string | null;
    logo_left?: string | null;
}

/**
 * Staff sign-in for BITAC PMS.
 *
 * Deliberately NOT the stakeholder page's split layout: one white card
 * floating on the dark BITAC backdrop, so a person who has opened the wrong
 * door sees at a glance that this is the office's own system. The
 * department flow under the card names what the system runs.
 */
const FLOW = ['IED', 'PCD', 'Shops', 'QC', 'Delivery', 'Billing'];

export default function Login({ status, canResetPassword, bitac }: {
    status?: string;
    canResetPassword: boolean;
    bitac?: Bitac | null;
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

    const emblem = bitac?.logo_left || theme.logo_url;
    const name = bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)';

    return (
        <>
            <Head title="Staff Sign In — BITAC PMS" />
            <div className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-ink-950 text-white">
                {/* The backdrop: drafting grid, two glows, the site's gear. */}
                <div className="absolute inset-0 bg-blueprint opacity-80" />
                <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[56rem] h-[36rem] rounded-full bg-brand-600/25 blur-3xl" />
                <div className="absolute -bottom-56 -right-24 w-[34rem] h-[34rem] rounded-full bg-amber-500/[0.07] blur-3xl" />
                <svg viewBox="0 0 400 400" aria-hidden="true"
                     className="absolute -left-48 -bottom-56 w-[40rem] h-[40rem] opacity-[0.05] pointer-events-none">
                    <g className="gear-turn"><path d={gearPath(200, 200, 190, 160, 18)} fill="white" fillRule="evenodd" /></g>
                </svg>
                <svg viewBox="0 0 400 400" aria-hidden="true"
                     className="absolute -right-24 -top-24 w-[22rem] h-[22rem] opacity-[0.04] pointer-events-none">
                    <g className="gear-turn"><path d={gearPath(200, 200, 190, 150, 14)} fill="white" fillRule="evenodd" /></g>
                </svg>

                <header className="relative flex items-center justify-between gap-4 px-6 sm:px-10 py-6">
                    <a href="/portfolio" className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60 hover:text-white transition-colors">
                        <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to website
                    </a>
                    <Link href="/customer/login" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">
                        Stakeholder? <span className="font-semibold text-white">Sign in here</span>
                    </Link>
                </header>

                <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10">
                    {/* Identity above the card. */}
                    <div className="flex flex-col items-center text-center mb-8">
                        {emblem && (
                            <span className="w-16 h-16 rounded-2xl bg-white p-2 ring-4 ring-white/10">
                                <img src={emblem} alt="" className="w-full h-full object-contain" />
                            </span>
                        )}
                        <div className="mt-4 text-[15px] sm:text-base font-bold leading-snug max-w-md">{name}</div>
                        <div className="text-xs text-white/50 mt-1">{bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'}</div>
                    </div>

                    <div className="w-full max-w-[420px] rounded-3xl bg-white text-surface-900 p-7 sm:p-9 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.6)]">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Staff sign in</h1>
                                <p className="text-sm text-surface-600 mt-1">{theme.brand_name || 'BITAC PMS'} · Production Management System</p>
                            </div>
                            <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-shield-check text-lg leading-none" />
                            </span>
                        </div>

                        {status && (
                            <div className="mt-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2.5">
                                <i className="fi fi-rr-check-circle text-sm leading-none shrink-0" />
                                <span>{status}</span>
                            </div>
                        )}

                        <form onSubmit={submit} className="mt-7 space-y-5">
                            <Field id="email" label="Email" icon="fi-rr-envelope" error={errors.email}>
                                <input
                                    id="email" type="email" value={data.email}
                                    onChange={e => setData('email', e.target.value)}
                                    className={inputClass(!!errors.email)}
                                    placeholder="you@bitac.gov.bd" autoComplete="username" autoFocus required
                                />
                            </Field>

                            <Field id="password" label="Password" icon="fi-rr-lock" error={errors.password}
                                   aside={canResetPassword && (
                                       <Link href={route('password.request')} className="text-[13px] font-semibold text-brand-700 hover:underline underline-offset-2">
                                           Forgot password?
                                       </Link>
                                   )}>
                                <input
                                    id="password" type={showPassword ? 'text' : 'password'} value={data.password}
                                    onChange={e => setData('password', e.target.value)}
                                    className={inputClass(!!errors.password) + ' pr-12'}
                                    placeholder="Your password" autoComplete="current-password" required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-surface-400 hover:text-surface-800 transition-colors">
                                    <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                                </button>
                            </Field>

                            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                                <input type="checkbox" checked={data.remember}
                                       onChange={e => setData('remember', e.target.checked as any)}
                                       className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30" />
                                <span className="text-sm text-surface-700">Keep me signed in</span>
                            </label>

                            <button type="submit" disabled={processing}
                                    className="group w-full h-12 rounded-xl bg-ink-950 hover:bg-brand-700 text-white text-[15px] font-semibold
                                               disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                               flex items-center justify-center gap-2">
                                {processing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in…</>
                                    : <>Sign in <i className="fi fi-rr-arrow-small-right text-lg leading-none group-hover:translate-x-0.5 transition-transform" /></>}
                            </button>
                        </form>

                        <p className="mt-7 pt-5 border-t border-surface-200 text-xs text-surface-500 leading-relaxed flex items-start gap-2">
                            <i className="fi fi-rr-info text-xs leading-none mt-0.5 shrink-0" />
                            For BITAC staff only. Accounts are created by the system administrator.
                        </p>
                    </div>

                    {/* What the system runs, end to end. */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                        {FLOW.map((s, i) => (
                            <span key={s} className="inline-flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04]">{s}</span>
                                {i < FLOW.length - 1 && <i className="fi fi-rr-angle-small-right text-xs leading-none text-amber-300/70" />}
                            </span>
                        ))}
                    </div>
                </main>

                <footer className="relative px-6 sm:px-10 py-6 flex items-center justify-between text-xs text-white/40">
                    <span>&copy; {new Date().getFullYear()} BITAC</span>
                    <a href="https://technocratsbd.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        Developed by <span className="font-semibold text-white/60">Technocrats</span>
                    </a>
                </footer>
            </div>
        </>
    );
}

function inputClass(invalid: boolean): string {
    return 'w-full h-12 pl-11 pr-4 rounded-xl border bg-surface-50 text-[15px] text-surface-900 placeholder:text-surface-400 '
        + 'focus:outline-none focus:bg-white focus:ring-4 transition-colors '
        + (invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
            : 'border-surface-200 hover:border-surface-300 focus:border-brand-500 focus:ring-brand-500/15');
}

function Field({ id, label, icon, error, aside, children }: {
    id: string; label: string; icon: string; error?: string; aside?: ReactNode; children: ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label htmlFor={id} className="text-sm font-semibold text-surface-800">{label}</label>
                {aside}
            </div>
            <div className="relative">
                <i className={`fi ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-sm leading-none text-surface-400 pointer-events-none`} />
                {children}
            </div>
            {error && (
                <p className="mt-2 text-sm text-rose-700 flex items-center gap-1.5">
                    <i className="fi fi-rr-exclamation text-xs leading-none" />{error}
                </p>
            )}
        </div>
    );
}
