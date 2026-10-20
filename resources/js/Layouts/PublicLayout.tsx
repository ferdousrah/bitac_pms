import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode, useEffect, useState } from 'react';

export interface BitacInfo {
    name_bn?: string | null;
    name_en?: string | null;
    caption?: string | null;
    ministry_bn?: string | null;
    government_bn?: string | null;
    address_bn?: string | null;
    address?: string | null;
    phone_bn?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logo_left?: string | null;
    logo_right?: string | null;
}

export interface SiteLinkRow { label: string; url: string }

interface Props {
    title: string;
    bitac?: BitacInfo;
    links?: Record<string, SiteLinkRow[]>;
    /** Full-bleed hero pages set this so the header floats over the artwork. */
    transparentHeader?: boolean;
    children: ReactNode;
}

/** The site's own navigation. One list, so the header and footer cannot drift. */
export const NAV = [
    { href: '/portfolio',          label: 'Home' },
    { href: '/portfolio/about',    label: 'About BITAC' },
    { href: '/portfolio/products', label: 'Products & Services' },
    { href: '/portfolio/clients',  label: 'Clients' },
    { href: '/portfolio/news',     label: 'News & Events' },
    { href: '/portfolio/gallery',  label: 'Photo Gallery' },
    { href: '/portfolio/videos',   label: 'Video Gallery' },
    { href: '/portfolio/contact',  label: 'Contact' },
];

/**
 * Chrome for BITAC's public website — deliberately nothing like AppLayout:
 * no sidebar, no auth, no app shell. A government corporate site: a utility
 * strip naming the ministry, a branded masthead, a horizontal nav, and a
 * footer that carries the address, the quick links and the important links.
 *
 * ⚠️ Text is rendered exactly as the editor typed it, in whatever language
 * that was (BITAC) — there is no translation layer, no language toggle and no
 * paired BN/EN fields. Nothing forces `font-bangla` either: the default `sans`
 * stack is Inter followed by SiyamRupali, and the browser falls through per
 * glyph, so one field holding either language sets correctly in both.
 */
export default function PublicLayout({ title, bitac, links, transparentHeader = false, children }: Props) {
    const { url } = usePage();
    const [open, setOpen] = useState(false);
    const [solid, setSolid] = useState(!transparentHeader);

    // A transparent header over a hero has to become solid once it is scrolled
    // onto white, or the links vanish into the page.
    useEffect(() => {
        if (!transparentHeader) return;
        const onScroll = () => setSolid(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [transparentHeader]);

    // Close the mobile menu on navigation — otherwise it stays open over the
    // page you just asked for.
    useEffect(() => { setOpen(false); }, [url]);

    const isActive = (href: string) =>
        href === '/portfolio' ? url === '/portfolio' : url.startsWith(href);

    const important = links?.important ?? [];
    const ministry = links?.ministry ?? [];

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Head title={title} />

            {/* ── Utility strip: whose office this is, and the two ways in ── */}
            <div className="bg-surface-900 text-surface-300 text-[11px]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4">
                    <div className="truncate">
                        {bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'} · {bitac?.government_bn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার'}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        {bitac?.phone_bn && (
                            <span className="hidden md:inline">
                                <i className="fi fi-rr-phone-call text-[10px] mr-1" />{bitac.phone_bn}
                            </span>
                        )}
                        {/* Two different doors, and the difference matters to a
                            visitor: a client tracks their own order, staff run
                            the system. */}
                        <a href="/customer/login" className="hover:text-white transition-colors font-semibold">
                            <i className="fi fi-rr-briefcase text-[10px] mr-1" />Customer Login
                        </a>
                        <a href="/login" className="hover:text-white transition-colors">
                            <i className="fi fi-rr-user text-[10px] mr-1" />Staff
                        </a>
                    </div>
                </div>
            </div>

            {/* ── Masthead + navigation ─────────────────────────────────── */}
            <header className={`sticky top-0 z-40 transition-colors ${
                solid ? 'bg-white/95 backdrop-blur border-b border-surface-200 shadow-sm' : 'bg-transparent'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-20 flex items-center justify-between gap-4">
                        <Link href="/portfolio" className="flex items-center gap-3 min-w-0 group">
                            {bitac?.logo_left && (
                                <img src={bitac.logo_left} alt="" className="h-12 w-12 object-contain shrink-0" />
                            )}
                            <div className="min-w-0">
                                <div className="text-[9px] uppercase tracking-[0.18em] text-brand-600 font-bold">
                                    {bitac?.caption || 'BITAC — A Centre of Excellence'}
                                </div>
                                <div className="text-[15px] sm:text-lg font-bold text-surface-900 leading-tight truncate group-hover:text-brand-600 transition-colors">
                                    {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)'}
                                </div>
                                <div className="text-[10px] text-surface-500 hidden sm:block truncate">
                                    {bitac?.name_en || 'Bangladesh Industrial Technical Assistance Centre'}
                                </div>
                            </div>
                        </Link>

                        <button
                            type="button"
                            onClick={() => setOpen(o => !o)}
                            aria-label="Menu"
                            aria-expanded={open}
                            className="lg:hidden p-2 rounded-lg text-surface-700 hover:bg-surface-100"
                        >
                            <i className={`fi ${open ? 'fi-rr-cross-small text-xl' : 'fi-rr-menu-burger text-base'} leading-none`} />
                        </button>

                        <nav className="hidden lg:flex items-center gap-1">
                            {NAV.map(n => (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                                        isActive(n.href)
                                            ? 'text-brand-700 bg-brand-50'
                                            : 'text-surface-600 hover:text-brand-700 hover:bg-surface-50'
                                    }`}
                                >
                                    {n.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Mobile drawer */}
                {open && (
                    <div className="lg:hidden border-t border-surface-200 bg-white">
                        <nav className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-1">
                            {NAV.map(n => (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold ${
                                        isActive(n.href) ? 'text-brand-700 bg-brand-50' : 'text-surface-700'
                                    }`}
                                >
                                    {n.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                )}
            </header>

            <main className="flex-1">{children}</main>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <footer className="bg-surface-900 text-surface-400 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-2.5 mb-3">
                            {bitac?.logo_left && <img src={bitac.logo_left} alt="" className="h-10 w-10 object-contain" />}
                            <div className="text-sm font-bold text-white leading-tight">
                                {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র'}
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed">
                            {bitac?.name_en || 'Bangladesh Industrial Technical Assistance Centre'} — an autonomous
                            body under the Ministry of Industries, serving the nation&rsquo;s industry since 1962.
                        </p>
                    </div>

                    <div>
                        <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-3">Explore</div>
                        <ul className="space-y-1.5 text-xs">
                            {NAV.slice(1).map(n => (
                                <li key={n.href}>
                                    <Link href={n.href} className="hover:text-white transition-colors">{n.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-3">Important Links</div>
                        <ul className="space-y-1.5 text-xs">
                            {[...important, ...ministry].slice(0, 8).map(l => (
                                <li key={l.url + l.label}>
                                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                                       className="hover:text-white transition-colors">
                                        {l.label}
                                        <i className="fi fi-rr-arrow-up-right-from-square text-[8px] ml-1 opacity-60" />
                                    </a>
                                </li>
                            ))}
                            {important.length === 0 && ministry.length === 0 && (
                                <li className="text-surface-600">—</li>
                            )}
                        </ul>
                    </div>

                    <div>
                        <div className="text-[11px] font-bold text-white uppercase tracking-wider mb-3">Contact</div>
                        <address className="not-italic text-xs space-y-2 leading-relaxed">
                            <div>
                                <i className="fi fi-rr-marker text-[10px] mr-1.5 opacity-70" />
                                {bitac?.address_bn || bitac?.address || '১১৬ (খ), তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮'}
                            </div>
                            {(bitac?.phone_bn || bitac?.phone) && (
                                <div>
                                    <i className="fi fi-rr-phone-call text-[10px] mr-1.5 opacity-70" />
                                    {bitac?.phone_bn || bitac?.phone}
                                </div>
                            )}
                            {bitac?.email && (
                                <div>
                                    <i className="fi fi-rr-envelope text-[10px] mr-1.5 opacity-70" />
                                    <a href={`mailto:${bitac.email}`} className="hover:text-white">{bitac.email}</a>
                                </div>
                            )}
                            {bitac?.website && (
                                <div>
                                    <i className="fi fi-rr-globe text-[10px] mr-1.5 opacity-70" />
                                    <a href={`https://${bitac.website}`} target="_blank" rel="noopener noreferrer"
                                       className="hover:text-white">{bitac.website}</a>
                                </div>
                            )}
                        </address>
                    </div>
                </div>

                <div className="border-t border-surface-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-surface-500">
                        <span>© {new Date().getFullYear()} BITAC — Bangladesh Industrial Technical Assistance Centre</span>
                        <span className="flex items-center gap-4">
                            <a href="/customer/login" className="hover:text-white">Customer Login</a>
                            <a href="/login" className="hover:text-white">Staff Login</a>
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
