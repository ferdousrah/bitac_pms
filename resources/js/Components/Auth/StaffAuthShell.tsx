import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';
import { applyTheme, type AppSettings } from '@/lib/theme';
import { gearPath } from '@/Components/Public/Gear';
import { AuthBitac, BITAC_NAME_FALLBACK } from './AuthField';

/**
 * The staff side's sign-in pages (sign in, forgot password): one white card
 * floating on the dark BITAC backdrop, the emblem and name above it.
 *
 * Deliberately unlike `StakeholderAuthShell` — a person who has opened the
 * wrong door sees at a glance that this is the office's own system.
 */
export default function StaffAuthShell({ title, bitac, children }: {
    title: string; bitac?: AuthBitac | null; children: ReactNode;
}) {
    const { appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    if (typeof window !== 'undefined' && theme.primary_color) applyTheme(theme);

    const emblem = bitac?.logo_left || theme.logo_url;

    return (
        <>
            <Head title={title} />
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
                    <a href="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-white/60 hover:text-white transition-colors">
                        <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to website
                    </a>
                    <Link href="/customer/login" className="text-[13px] font-medium text-white/60 hover:text-white transition-colors">
                        Stakeholder? <span className="font-semibold text-white">Sign in here</span>
                    </Link>
                </header>

                <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10">
                    <div className="flex flex-col items-center text-center mb-8">
                        {emblem && (
                            <span className="w-16 h-16 rounded-2xl bg-white p-2 ring-4 ring-white/10">
                                <img src={emblem} alt="" className="w-full h-full object-contain" />
                            </span>
                        )}
                        <div className="mt-4 text-[15px] sm:text-base font-bold leading-snug max-w-md">{bitac?.name_bn || BITAC_NAME_FALLBACK}</div>
                        <div className="text-xs text-white/50 mt-1">{bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'}</div>
                    </div>

                    <div className="w-full max-w-[420px] rounded-3xl bg-white text-surface-900 p-7 sm:p-9 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.6)]">
                        {children}
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

/** The card's heading row: title, a line under it, an icon tile on the right. */
export function StaffCardHead({ title, subtitle, icon }: { title: string; subtitle: ReactNode; icon: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-sm text-surface-600 mt-1 leading-relaxed">{subtitle}</p>
            </div>
            <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <i className={`fi ${icon} text-lg leading-none`} />
            </span>
        </div>
    );
}
