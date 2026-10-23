import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';
import { gearPath } from '@/Components/Public/Gear';
import { AuthBitac, BITAC_NAME_FALLBACK, telHref } from './AuthField';

/**
 * The stakeholder (customer portal) side's sign-in pages: an ink brand panel
 * on the left — emblem, name, what the portal does, BITAC's contacts — and the
 * form on white. Reached from the public website's "Stakeholder Login", so it
 * wears the website's identity rather than the app's.
 *
 * On a phone the panel is hidden; the emblem and name sit above the form.
 */
const FEATURES: [string, string, string][] = [
    ['fi-rr-route', 'Follow every job', 'Planning, the shop floor, QC and delivery — see where your order is.'],
    ['fi-rr-file-invoice-dollar', 'Quotations & bills', 'Read quotations, bills and payments as soon as they are issued.'],
    ['fi-rr-folder-download', 'Your documents', 'Challans, certificates and letters, ready to download any time.'],
];

export default function StakeholderAuthShell({ title, bitac, children }: {
    title: string; bitac?: AuthBitac | null; children: ReactNode;
}) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const name = bitac?.name_bn || BITAC_NAME_FALLBACK;
    const phone = (bitac?.phone_bn ?? '').split(/[,;]/)[0]?.trim();
    const emblem = bitac?.logo_left || theme.logo_url;

    return (
        <>
            <Head title={title} />
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

                    <a href="/" className="relative flex items-center gap-4 group w-fit">
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
                            {FEATURES.map(([icon, t, text]) => (
                                <li key={t} className="flex gap-4">
                                    <span className="w-11 h-11 rounded-xl bg-white/[0.07] border border-white/10 text-amber-300 flex items-center justify-center shrink-0">
                                        <i className={`fi ${icon} text-base leading-none`} />
                                    </span>
                                    <span>
                                        <span className="block text-[15px] font-semibold text-white">{t}</span>
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
                        <a href="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-surface-600 hover:text-brand-700 transition-colors">
                            <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to website
                        </a>
                        <Link href="/login" className="text-[13px] font-medium text-surface-600 hover:text-brand-700 transition-colors">
                            BITAC staff? <span className="font-semibold text-surface-900">Sign in here</span>
                        </Link>
                    </header>

                    <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12">
                        <div className="w-full max-w-[400px]">
                            <div className="lg:hidden flex items-center gap-3 mb-10">
                                {emblem && <img src={emblem} alt="" className="w-12 h-12 object-contain shrink-0" />}
                                <span className="text-[15px] font-bold text-surface-900 leading-snug">{name}</span>
                            </div>

                            {children}

                            {/* The brand panel carries these on a wide screen. */}
                            {(phone || bitac?.email) && (
                                <div className="lg:hidden mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                    {phone && <a href={telHref(phone)} className="whitespace-nowrap font-semibold text-surface-900 hover:text-brand-700">{phone}</a>}
                                    {bitac?.email && <a href={`mailto:${bitac.email}`} className="whitespace-nowrap font-semibold text-surface-900 hover:text-brand-700">{bitac.email}</a>}
                                </div>
                            )}
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

/** The badge + heading + line that opens each stakeholder form. */
export function StakeholderHead({ title, lead, badgeIcon = 'fi-rr-handshake' }: { title: string; lead: ReactNode; badgeIcon?: string }) {
    return (
        <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                <i className={`fi ${badgeIcon} text-[11px] leading-none`} /> Stakeholder Portal
            </div>
            <h1 className="text-3xl font-bold text-surface-900 tracking-tight mt-4">{title}</h1>
            <p className="text-[15px] text-surface-600 mt-2 leading-relaxed">{lead}</p>
        </>
    );
}
