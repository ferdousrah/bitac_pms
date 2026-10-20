import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, ReactNode, useState } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';
import { gearPath } from '@/Components/Public/Gear';

interface Bitac {
    name_bn?: string | null;
    ministry_bn?: string | null;
    government_bn?: string | null;
    phone_bn?: string | null;
    email?: string | null;
    logo_left?: string | null;
}

/**
 * The customer portal's sign-in — reached from the public website's
 * "Stakeholder Login", so it wears the same identity: BITAC's emblem and
 * Bangla name on an ink panel, and calls itself the Stakeholder Portal.
 * Left panel from lg up; on a phone the emblem and name sit above the form.
 */
const FEATURES: [string, string, string][] = [
    ['fi-rr-route', 'Follow every job', 'Planning, the shop floor, QC and delivery — see where your order is.'],
    ['fi-rr-file-invoice-dollar', 'Quotations & bills', 'Read quotations, bills and payments as soon as they are issued.'],
    ['fi-rr-folder-download', 'Your documents', 'Challans, certificates and letters, ready to download any time.'],
];

const BN = '০১২৩৪৫৬৭৮৯';
const telHref = (n: string) => 'tel:' + n.replace(/[০-৯]/g, d => String(BN.indexOf(d))).replace(/[^\d+]/g, '');

export default function CustomerLogin({ bitac }: { bitac?: Bitac | null }) {
    const { appSettings, flash } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const [showPassword, setShowPassword] = useState(false);
    const successMsg = flash?.success as string | undefined;

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

    const name = bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)';
    const phone = (bitac?.phone_bn ?? '').split(/[,;]/)[0]?.trim();
    const emblem = bitac?.logo_left || theme.logo_url;

    return (
        <>
            <Head title="Stakeholder Portal — Sign In" />
            <div className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-white">

                {/* ── The brand panel ─────────────────────────────────────── */}
                <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink-950 text-white px-12 xl:px-16 py-12">
                    <div className="absolute inset-0 bg-blueprint opacity-80" />
                    <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-brand-600/20 blur-3xl" />
                    <div className="absolute -bottom-48 right-0 w-[30rem] h-[30rem] rounded-full bg-amber-500/[0.06] blur-3xl" />
                    <svg viewBox="0 0 400 400" aria-hidden="true"
                         className="absolute -right-40 -bottom-40 w-[36rem] h-[36rem] opacity-[0.06] pointer-events-none">
                        <g className="gear-turn"><path d={gearPath(200, 200, 190, 160, 18)} fill="white" fillRule="evenodd" /></g>
                    </svg>

                    <a href="/portfolio" className="relative flex items-center gap-4 group w-fit">
                        {emblem && (
                            <span className="w-14 h-14 rounded-2xl bg-white p-1.5 shrink-0">
                                <img src={emblem} alt="" className="w-full h-full object-contain" />
                            </span>
                        )}
                        <span>
                            <span className="block text-lg font-bold leading-snug group-hover:text-brand-200 transition-colors">{name}</span>
                            <span className="block text-xs text-white/55 mt-0.5">
                                {bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'} · {bitac?.government_bn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার'}
                            </span>
                        </span>
                    </a>

                    <div className="relative max-w-lg py-12">
                        <div className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] font-bold text-amber-300">
                            <span className="h-px w-8 bg-amber-400" /> Stakeholder Portal
                        </div>
                        <h2 className="text-4xl xl:text-[44px] font-bold leading-[1.1] mt-4">
                            Your work with BITAC,<br />
                            <span className="bg-gradient-to-r from-amber-200 to-brand-300 bg-clip-text text-transparent">in one place.</span>
                        </h2>
                        <ul className="mt-10 space-y-6">
                            {FEATURES.map(([icon, title, text]) => (
                                <li key={title} className="flex gap-4">
                                    <span className="w-11 h-11 rounded-xl bg-white/[0.07] border border-white/10 text-amber-300 flex items-center justify-center shrink-0">
                                        <i className={`fi ${icon} text-base leading-none`} />
                                    </span>
                                    <span>
                                        <span className="block text-[15px] font-semibold text-white">{title}</span>
                                        <span className="block text-sm text-white/60 mt-0.5 leading-relaxed">{text}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/60">
                        <span className="text-white/45">No account yet? Ask BITAC:</span>
                        {phone && (
                            <a href={telHref(phone)} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                                <i className="fi fi-rr-phone-call text-[11px] leading-none text-amber-300" />{phone}
                            </a>
                        )}
                        {bitac?.email && (
                            <a href={`mailto:${bitac.email}`} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                                <i className="fi fi-rr-envelope text-[11px] leading-none text-amber-300" />{bitac.email}
                            </a>
                        )}
                    </div>
                </aside>

                {/* ── The form ─────────────────────────────────────────────── */}
                <div className="flex flex-col min-h-[100dvh] lg:min-h-0">
                    <header className="flex items-center justify-between gap-4 px-6 sm:px-10 pt-6">
                        <a href="/portfolio" className="inline-flex items-center gap-2 text-[13px] font-medium text-surface-600 hover:text-brand-700 transition-colors">
                            <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to website
                        </a>
                        <Link href="/login" className="text-[13px] font-medium text-surface-600 hover:text-brand-700 transition-colors">
                            BITAC staff? <span className="font-semibold text-surface-900">Sign in here</span>
                        </Link>
                    </header>

                    <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12">
                        <div className="w-full max-w-[400px]">
                            {/* On a phone the brand panel is hidden — keep the identity. */}
                            <div className="lg:hidden flex items-center gap-3 mb-10">
                                {emblem && <img src={emblem} alt="" className="w-12 h-12 object-contain shrink-0" />}
                                <span className="text-[15px] font-bold text-surface-900 leading-snug">{name}</span>
                            </div>

                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                                <i className="fi fi-rr-handshake text-[11px] leading-none" /> Stakeholder Portal
                            </div>
                            <h1 className="text-3xl font-bold text-surface-900 tracking-tight mt-4">Welcome back</h1>
                            <p className="text-[15px] text-surface-600 mt-2">Sign in to follow your jobs, quotations, bills and documents.</p>

                            {successMsg && (
                                <div className="mt-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2.5">
                                    <i className="fi fi-rr-check-circle text-sm leading-none shrink-0" />
                                    <span>{successMsg}</span>
                                </div>
                            )}

                            <form onSubmit={submit} className="mt-8 space-y-5">
                                <Field id="email" label="Email" error={errors.email} icon="fi-rr-envelope">
                                    <input
                                        id="email" type="email" value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        className={inputClass(!!errors.email)}
                                        placeholder="you@company.com" autoComplete="username" autoFocus required
                                    />
                                </Field>

                                <Field id="password" label="Password" error={errors.password} icon="fi-rr-lock"
                                       aside={<Link href="/customer/password/forgot" className="text-[13px] font-semibold text-brand-700 hover:underline underline-offset-2">Forgot password?</Link>}>
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
                                           onChange={e => setData('remember', e.target.checked)}
                                           className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30" />
                                    <span className="text-sm text-surface-700">Keep me signed in</span>
                                </label>

                                <button type="submit" disabled={processing}
                                        className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-semibold
                                                   disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                                   flex items-center justify-center gap-2">
                                    {processing
                                        ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in…</>
                                        : <>Sign in <i className="fi fi-rr-arrow-small-right text-lg leading-none" /></>}
                                </button>
                            </form>

                            <div className="mt-10 pt-6 border-t border-surface-200 text-sm text-surface-600 leading-relaxed">
                                Accounts are opened by BITAC for the organisations it works with.
                                {/* The brand panel carries these on a wide screen. */}
                                {(phone || bitac?.email) && (
                                    <div className="lg:hidden mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                        {phone && <a href={telHref(phone)} className="whitespace-nowrap font-semibold text-surface-900 hover:text-brand-700">{phone}</a>}
                                        {bitac?.email && <a href={`mailto:${bitac.email}`} className="whitespace-nowrap font-semibold text-surface-900 hover:text-brand-700">{bitac.email}</a>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>

                    <footer className="px-6 sm:px-10 pb-6 flex items-center justify-between text-xs text-surface-400">
                        <span>&copy; {new Date().getFullYear()} BITAC</span>
                        <a href="https://technocratsbd.com" target="_blank" rel="noopener noreferrer" className="hover:text-surface-700 transition-colors">
                            Developed by <span className="font-semibold">Technocrats</span>
                        </a>
                    </footer>
                </div>
            </div>
        </>
    );
}

function inputClass(invalid: boolean): string {
    return 'w-full h-12 pl-11 pr-4 rounded-xl border bg-white text-[15px] text-surface-900 placeholder:text-surface-400 '
        + 'focus:outline-none focus:ring-4 transition-colors '
        + (invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
            : 'border-surface-300 hover:border-surface-400 focus:border-brand-500 focus:ring-brand-500/15');
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
