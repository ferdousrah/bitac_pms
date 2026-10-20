import { Head, Link, usePage } from '@inertiajs/react';
import { gearPath } from '@/Components/Public/Gear';
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

export interface NavItem {
    href: string;
    label: string;
    /** A group: the parent is a dropdown, and `href` is where its first child goes. */
    children?: { href: string; label: string; icon?: string; note?: string }[];
}

/**
 * The site's own navigation — BITAC's wording and order.
 *
 * One list, so the header, the mobile drawer and the footer cannot drift
 * apart.
 *
 * ⚠️ **News & Events is deliberately NOT in the top menu** (BITAC's menu does
 * not list it) but the pages are very much alive — they are reached from the
 * home page and from the footer's Explore column, which is why `FOOTER_NAV`
 * exists separately rather than just flattening this.
 */
export const NAV: NavItem[] = [
    { href: '/portfolio',          label: 'Home' },
    { href: '/portfolio/about',    label: 'About Us' },
    { href: '/portfolio/services', label: 'Services' },
    { href: '/portfolio/products', label: 'Products' },
    { href: '/portfolio/clients',  label: 'Clients' },
    {
        href: '/portfolio/gallery', label: 'Gallery',
        children: [
            { href: '/portfolio/gallery', label: 'Photo Gallery', icon: 'fi-rr-picture',  note: 'Events, training and the shop floor' },
            { href: '/portfolio/videos',  label: 'Video Gallery', icon: 'fi-rr-play-alt', note: 'Films and recorded events' },
        ],
    },
    { href: '/portfolio/contact',  label: 'Contact Us' },
];

/** Every page, flattened, plus the ones the top menu leaves out. */
export const FOOTER_NAV: { href: string; label: string }[] = [
    ...NAV.slice(1).flatMap(n => (n.children ?? [n]).map(({ href, label }) => ({ href, label }))),
    { href: '/portfolio/news', label: 'News & Events' },
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
    const [menu, setMenu] = useState<string | null>(null);
    const [scrolled, setScrolled] = useState(false);
    // A transparent header over a hero has to become solid once it is scrolled
    // onto white, or the links vanish into the page.
    const solid = !transparentHeader || scrolled;

    // Scrolled -> the masthead tightens (80 -> 64px), so the sticky bar takes
    // less of the page while someone is reading.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close the mobile menu on navigation — otherwise it stays open over the
    // page you just asked for. The desktop dropdown goes with it.
    useEffect(() => { setOpen(false); setMenu(null); }, [url]);

    // A dropdown opened by hover still has to close on a click elsewhere, or
    // it hangs over the page on a touch screen where there is no mouse-out.
    useEffect(() => {
        if (!menu) return;
        const away = (e: MouseEvent) => {
            if (!(e.target as HTMLElement)?.closest('[data-navgroup]')) setMenu(null);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', esc);
        };
    }, [menu]);

    const isActive = (href: string) =>
        href === '/portfolio' ? url === '/portfolio' : url.startsWith(href);

    /** A group is lit when any page under it is open, not just its own href. */
    const groupActive = (n: NavItem) =>
        n.children ? n.children.some(c => isActive(c.href)) : isActive(n.href);

    const important = links?.important ?? [];
    const ministry = links?.ministry ?? [];

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Head title={title} />

            {/* ── Utility strip: whose office this is, and the two ways in ── */}
            <div className="bg-ink-950 text-white text-[11px]">
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
                        {/* The one action every page offers. It lived in the menu bar
                            at first, but next to seven links it squeezed the BITAC
                            name into "…" and wrapped "About Us" onto two lines. */}
                        <Link href="/portfolio/request-quotation"
                              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors">
                            <i className="fi fi-rr-paper-plane text-[10px] leading-none" />Request a Quotation
                        </Link>
                        <a href="/customer/login" className="hover:text-brand-300 transition-colors font-semibold">
                            <i className="fi fi-rr-briefcase text-[10px] mr-1" />Customer Login
                        </a>
                        <a href="/login" className="hover:text-brand-300 transition-colors">
                            <i className="fi fi-rr-user text-[10px] mr-1" />Staff
                        </a>
                    </div>
                </div>
            </div>

            {/* ── Masthead + navigation ─────────────────────────────────── */}
            <header className={`sticky top-0 z-40 transition-all duration-300 ${
                solid ? 'bg-white/95 backdrop-blur border-b border-surface-200' : 'bg-transparent'
            } ${scrolled ? 'shadow-[0_6px_24px_-12px_rgba(14,12,20,0.25)]' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className={`flex items-center justify-between gap-4 transition-[height] duration-300 ${scrolled ? 'h-16' : 'h-20'}`}>
                        <Link href="/portfolio" className="flex items-center gap-3 min-w-0 group">
                            {bitac?.logo_left && (
                                <img src={bitac.logo_left} alt=""
                                     className={`object-contain shrink-0 transition-all duration-300 ${scrolled ? 'h-10 w-10' : 'h-12 w-12'}`} />
                            )}
                            <div className="min-w-0">
                                <div className={`text-[9px] uppercase tracking-[0.18em] text-brand-600 font-bold transition-all duration-300 ${
                                    scrolled ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-4 opacity-100'
                                }`}>
                                    {bitac?.caption || 'BITAC — A Centre of Excellence'}
                                </div>
                                <div className="text-[15px] sm:text-lg lg:text-base xl:text-lg font-bold text-surface-900 leading-tight line-clamp-2 sm:line-clamp-none sm:truncate group-hover:text-brand-600 transition-colors">
                                    {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)'}
                                </div>
                                {/* No centre-name line under it (BITAC, 2026-10-20): the
                                    site speaks for BITAC as a whole, not "BITAC Dhaka". */}
                            </div>
                        </Link>

                        <button
                            type="button"
                            onClick={() => setOpen(o => !o)}
                            aria-label="Menu"
                            aria-expanded={open}
                            className={`lg:hidden w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors ${
                                open ? 'bg-ink-950 border-ink-950 text-white' : 'border-surface-200 text-surface-800 hover:bg-surface-50'
                            }`}
                        >
                            <i className={`fi ${open ? 'fi-rr-cross-small text-xl' : 'fi-rr-menu-burger text-base'} leading-none`} />
                        </button>

                        {/* Each link is the full height of the bar, so its underline
                            sits exactly on the header's bottom edge. */}
                        <div className="hidden lg:flex items-stretch self-stretch">
                            <nav className="flex items-stretch shrink-0">
                                {NAV.map(n => n.children ? (
                                    <div
                                        key={n.label}
                                        data-navgroup
                                        className="relative flex"
                                        onMouseEnter={() => setMenu(n.label)}
                                        onMouseLeave={() => setMenu(m => (m === n.label ? null : m))}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setMenu(m => (m === n.label ? null : n.label))}
                                            aria-expanded={menu === n.label}
                                            aria-haspopup="true"
                                            className={navLinkClass(groupActive(n), menu === n.label)}
                                        >
                                            <span className="flex items-center gap-1">
                                                {n.label}
                                                <i className={`fi fi-rr-angle-small-down text-[12px] leading-none transition-transform duration-200 ${
                                                    menu === n.label ? 'rotate-180' : ''
                                                }`} />
                                            </span>
                                        </button>
                                        {menu === n.label && (
                                            /* No gap between the button and the panel —
                                               a few pixels of nothing is enough for the
                                               pointer to leave and the menu to shut
                                               while someone is reaching for it. */
                                            <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 w-72 animate-fade-in">
                                                <div className="rounded-2xl bg-white border border-surface-200 shadow-[0_18px_40px_-16px_rgba(14,12,20,0.35)] p-2">
                                                    {n.children.map(c => (
                                                        <Link
                                                            key={c.href}
                                                            href={c.href}
                                                            className={`group/item flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                                                                isActive(c.href) ? 'bg-brand-50' : 'hover:bg-surface-50'
                                                            }`}
                                                        >
                                                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                                isActive(c.href)
                                                                    ? 'bg-brand-600 text-white'
                                                                    : 'bg-surface-100 text-surface-600 group-hover/item:bg-brand-600 group-hover/item:text-white'
                                                            }`}>
                                                                <i className={`fi ${c.icon ?? 'fi-rr-angle-small-right'} text-sm leading-none`} />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className={`block text-[14px] font-semibold ${isActive(c.href) ? 'text-brand-700' : 'text-surface-900'}`}>
                                                                    {c.label}
                                                                </span>
                                                                {c.note && <span className="block text-xs text-surface-500 mt-0.5">{c.note}</span>}
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Link key={n.href} href={n.href} className={navLinkClass(isActive(n.href))}
                                          aria-current={isActive(n.href) ? 'page' : undefined}>
                                        {n.label}
                                    </Link>
                                ))}
                            </nav>

                        </div>
                    </div>
                </div>

                {/* Mobile drawer */}
                {open && (
                    <div className="lg:hidden border-t border-surface-200 bg-white max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <nav className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-1 gap-0.5">
                            {NAV.map(n => n.children ? (
                                <div key={n.label} className="pt-2">
                                    <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-surface-500">
                                        {n.label}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                                        {n.children.map(c => (
                                            <Link
                                                key={c.href}
                                                href={c.href}
                                                className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-semibold ${
                                                    isActive(c.href)
                                                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                                                        : 'border-surface-200 text-surface-800'
                                                }`}
                                            >
                                                <i className={`fi ${c.icon ?? 'fi-rr-angle-small-right'} text-sm leading-none`} />
                                                {c.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    className={`flex items-center justify-between px-3 py-3 rounded-xl text-[15px] font-semibold ${
                                        isActive(n.href) ? 'text-brand-700 bg-brand-50' : 'text-surface-800 hover:bg-surface-50'
                                    }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <span className={`w-1 h-5 rounded-full ${isActive(n.href) ? 'bg-brand-600' : 'bg-surface-200'}`} />
                                        {n.label}
                                    </span>
                                    <i className="fi fi-rr-angle-small-right text-base leading-none text-surface-400" />
                                </Link>
                            ))}

                            <div className="mt-3 pt-4 border-t border-surface-200 grid grid-cols-1 gap-2 pb-2">
                                <Link href="/portfolio/request-quotation"
                                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" /> Request a Quotation
                                </Link>
                                <div className="grid grid-cols-2 gap-2">
                                    <a href="/customer/login" className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-surface-200 text-surface-800 text-sm font-semibold">
                                        <i className="fi fi-rr-briefcase text-xs leading-none" /> Customer Login
                                    </a>
                                    <a href="/login" className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-surface-200 text-surface-800 text-sm font-semibold">
                                        <i className="fi fi-rr-user text-xs leading-none" /> Staff
                                    </a>
                                </div>
                            </div>
                        </nav>
                    </div>
                )}
            </header>

            {/* ⚠️ The footer's wave is drawn UP into the last section's bottom
                padding (40px / 80px) and used nearly all of it, so content ran
                right into the wave. The last section gets extra padding of its
                own — on the section itself, so its own background (white or
                tint) continues and no strip of another colour appears. */}
            <main className="flex-1 [&>*:last-child]:pb-12 sm:[&>*:last-child]:pb-20">{children}</main>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <SiteFooter bitac={bitac} important={important} ministry={ministry} />
        </div>
    );
}

/**
 * A top-level menu entry: the full height of the bar, with a 3px underline on
 * its bottom edge — drawn in for the current page, sliding in on hover.
 * Written out in full; Tailwind does not ship a class built from a variable.
 */
function navLinkClass(active: boolean, open = false): string {
    const base = 'relative flex items-center whitespace-nowrap px-2.5 xl:px-3.5 text-[13px] xl:text-[14px] font-semibold transition-colors '
        + 'after:absolute after:left-2.5 after:right-2.5 xl:after:left-3.5 xl:after:right-3.5 after:bottom-0 after:h-[3px] after:rounded-t-full '
        + 'after:bg-brand-600 after:transition-transform after:duration-200 ';
    if (active) return base + 'text-brand-700 after:scale-x-100';
    if (open) return base + 'text-brand-700 after:scale-x-0';
    return base + 'text-surface-700 hover:text-brand-700 after:scale-x-0 hover:after:scale-x-100';
}

/** A stored website may or may not carry its scheme; never prefix it twice. */
function siteHref(website?: string | null): string | undefined {
    if (!website) return undefined;
    return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/**
 * The public footer.
 *
 * ⚠️ The wave is drawn ABOVE the footer (`bottom-full`), overlapping the last
 * section's bottom padding, so its transparent part shows that section's own
 * background — white on one page, tinted on another. Put in normal flow
 * instead, the transparent part would show the layout's white and leave a
 * white strip under every tinted section. It is kept short (40/64px) because
 * every section has at least 56px of bottom padding for it to sit in.
 *
 * ⚠️ `overflow-hidden` is on the INNER block, not the <footer>: on the footer
 * it would clip the wave, which deliberately sits outside it.
 */
function SiteFooter({ bitac, important, ministry }: {
    bitac?: BitacInfo; important: SiteLinkRow[]; ministry: SiteLinkRow[];
}) {
    const { props } = usePage<any>();
    const services: { id: number; title: string }[] = props.footer_services ?? [];
    const phones = (bitac?.phone_bn || bitac?.phone || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const address = bitac?.address_bn || bitac?.address || '১১৬ (খ), তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮';
    const outside = [...important, ...ministry].slice(0, 7);

    return (
        <footer className="relative text-white/65">
            {/* The shape: two waves, the back one a brighter violet, for depth.
                Tall enough to read as a shape at 1440px — at 64px and a gentle
                curve it read as a thin lavender smear across the page. */}
            <svg className="absolute bottom-full left-0 w-full h-10 sm:h-20 pointer-events-none" viewBox="0 0 1440 120"
                 preserveAspectRatio="none" aria-hidden="true">
                <path d="M0,46 C170,96 360,4 610,34 C860,64 1010,112 1250,62 C1350,42 1410,48 1440,54 L1440,120 L0,120 Z"
                      fill="rgb(var(--brand-600, 98 49 155))" opacity="0.75" />
                <path d="M0,84 C230,40 430,114 720,82 C1010,50 1210,110 1440,72 L1440,120 L0,120 Z"
                      fill="#0e0c14" />
            </svg>

            <div className="relative bg-ink-950 overflow-hidden">
                <div className="absolute inset-0 bg-blueprint opacity-70" />
                <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-brand-600/15 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-[28rem] h-[20rem] rounded-full bg-amber-500/[0.05] blur-3xl" />
                {/* A large gear turning slowly behind the columns — the site's
                    one motif, carried down from the hero. */}
                <svg viewBox="0 0 400 400" aria-hidden="true"
                     className="absolute -right-32 -bottom-40 w-[34rem] h-[34rem] opacity-[0.045] pointer-events-none">
                    <g className="gear-turn">
                        <path d={gearPath(200, 200, 190, 160, 18)} fill="white" fillRule="evenodd" />
                    </g>
                </svg>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* ── The columns ──
                        BITAC (2026-10-20): the head office's address, phone and
                        email sit under the name, where the about line was — the
                        three big "Call / Email / Visit" tiles above the columns
                        were removed. */}
                    <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10 pt-16 pb-14">
                        <div className="col-span-2 lg:col-span-4">
                            <div className="flex items-center gap-3">
                                {bitac?.logo_left && (
                                    <span className="w-14 h-14 rounded-2xl bg-white p-1.5 shrink-0 shadow-lg shadow-black/20">
                                        <img src={bitac.logo_left} alt="" className="w-full h-full object-contain" />
                                    </span>
                                )}
                                <span className="min-w-0">
                                    <span className="block text-[15px] font-bold text-white leading-snug">
                                        {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র'}
                                    </span>
                                    <span className="block text-[11px] text-white/45 mt-0.5">
                                        {bitac?.name_en || 'Bangladesh Industrial Technical Assistance Centre'}
                                    </span>
                                </span>
                            </div>
                            <ul className="mt-6 space-y-3 text-[13px] max-w-sm">
                                <li className="flex items-start gap-3">
                                    <FooterIcon icon="fi-rr-marker" />
                                    <Link href="/portfolio/contact" className="text-white/80 hover:text-white leading-relaxed transition-colors">{address}</Link>
                                </li>
                                {phones.length > 0 && (
                                    <li className="flex items-start gap-3">
                                        <FooterIcon icon="fi-rr-phone-call" />
                                        <span className="flex flex-wrap gap-x-1 leading-relaxed">
                                            {phones.map((n, i) => (
                                                <span key={n}>
                                                    <a href={telHref(n)} className="text-white/80 hover:text-white transition-colors">{n}</a>
                                                    {i < phones.length - 1 && <span className="text-white/40">,</span>}
                                                </span>
                                            ))}
                                        </span>
                                    </li>
                                )}
                                {bitac?.email && (
                                    <li className="flex items-start gap-3">
                                        <FooterIcon icon="fi-rr-envelope" />
                                        <a href={`mailto:${bitac.email}`} className="text-white/80 hover:text-white leading-relaxed break-all transition-colors">{bitac.email}</a>
                                    </li>
                                )}
                            </ul>
                            <div className="flex flex-wrap items-center gap-2.5 mt-6">
                                <a href="/customer/login"
                                   className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-xs font-bold shadow-lg shadow-black/20 transition-all">
                                    <i className="fi fi-rr-briefcase text-[11px] leading-none" />Customer login
                                </a>
                                <a href="/login"
                                   className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-bold transition-colors">
                                    <i className="fi fi-rr-user text-[11px] leading-none" />Staff
                                </a>
                            </div>
                        </div>

                        <FooterColumn title="Explore" className="lg:col-span-2">
                            {FOOTER_NAV.map(n => (
                                <FooterLink key={n.href} href={n.href} internal>{n.label}</FooterLink>
                            ))}
                        </FooterColumn>

                        <FooterColumn title="What we do" className="lg:col-span-3">
                            {services.length ? services.map(x => (
                                <FooterLink key={x.id} href="/portfolio/services" internal>{x.title}</FooterLink>
                            )) : (
                                <FooterLink href="/portfolio/services" internal>Our services</FooterLink>
                            )}
                        </FooterColumn>

                        <FooterColumn title="Important links" className="col-span-2 sm:col-span-1 lg:col-span-3">
                            {outside.length ? outside.map(l => (
                                <FooterLink key={l.url + l.label} href={l.url}>{l.label}</FooterLink>
                            )) : (
                                <li className="text-white/30">—</li>
                            )}
                        </FooterColumn>
                    </div>

                    {/* ── Bottom bar ── */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-white/10 text-[12px] text-white/40">
                        <span className="text-center sm:text-left">
                            © {new Date().getFullYear()} BITAC · {bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'}, {bitac?.government_bn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার'}
                        </span>
                        <div className="flex items-center gap-5">
                            {bitac?.website && (
                                <a href={siteHref(bitac.website)} target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
                                    <i className="fi fi-rr-globe text-[11px] leading-none" />
                                    {bitac.website.replace(/^https?:\/\//i, '')}
                                </a>
                            )}
                            <button type="button" aria-label="Back to top"
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                    className="group w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-brand-500 border border-white/10 hover:border-brand-400 text-white flex items-center justify-center transition-all">
                                <i className="fi fi-rr-arrow-small-up text-base leading-none group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

/** A Bangla-digit `tel:` dials nothing — the number keeps its face, the link goes ASCII. */
function telHref(n: string): string {
    return 'tel:' + n.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^\d+]/g, '');
}

function FooterIcon({ icon }: { icon: string }) {
    return (
        <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 text-amber-300 flex items-center justify-center shrink-0">
            <i className={`fi ${icon} text-[11px] leading-none`} />
        </span>
    );
}

function FooterColumn({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
    return (
        <div className={className}>
            <div className="flex items-center gap-2.5 mb-5">
                <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-amber-300 to-amber-500" />
                <span className="text-[12px] font-bold text-white uppercase tracking-[0.14em]">{title}</span>
            </div>
            <ul className="space-y-2.5 text-[13px]">{children}</ul>
        </div>
    );
}

/** A footer link whose arrow slides in on hover. */
function FooterLink({ href, internal = false, children }: { href: string; internal?: boolean; children: ReactNode }) {
    const inner = (
        <>
            <i className="fi fi-rr-angle-small-right text-xs leading-none text-brand-400 w-0 overflow-hidden opacity-0 group-hover:w-3 group-hover:opacity-100 transition-all" />
            <span>{children}</span>
            {!internal && <i className="fi fi-rr-arrow-up-right text-[8px] leading-none opacity-40 ml-0.5" />}
        </>
    );
    const className = 'group inline-flex items-center gap-1 hover:text-white transition-colors';
    return (
        <li>
            {internal
                ? <Link href={href} className={className}>{inner}</Link>
                : <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>}
        </li>
    );
}
