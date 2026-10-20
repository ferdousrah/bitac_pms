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
    children?: { href: string; label: string }[];
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
            { href: '/portfolio/gallery', label: 'Photo Gallery' },
            { href: '/portfolio/videos',  label: 'Video Gallery' },
        ],
    },
    { href: '/portfolio/contact',  label: 'Contact Us' },
];

/** Every page, flattened, plus the ones the top menu leaves out. */
export const FOOTER_NAV: { href: string; label: string }[] = [
    ...NAV.slice(1).flatMap(n => n.children ?? [n]),
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
            <div className="bg-brand-950 text-white text-[11px]">
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
                            {NAV.map(n => n.children ? (
                                <div
                                    key={n.label}
                                    data-navgroup
                                    className="relative"
                                    onMouseEnter={() => setMenu(n.label)}
                                    onMouseLeave={() => setMenu(m => (m === n.label ? null : m))}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setMenu(m => (m === n.label ? null : n.label))}
                                        aria-expanded={menu === n.label}
                                        aria-haspopup="true"
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                                            groupActive(n) || menu === n.label
                                                ? 'text-brand-700 bg-brand-50'
                                                : 'text-surface-600 hover:text-brand-700 hover:bg-surface-50'
                                        }`}
                                    >
                                        {n.label}
                                        <i className={`fi fi-rr-angle-small-down text-[11px] leading-none transition-transform ${
                                            menu === n.label ? 'rotate-180' : ''
                                        }`} />
                                    </button>
                                    {menu === n.label && (
                                        /* No gap between the button and the panel —
                                           a few pixels of nothing is enough for the
                                           pointer to leave and the menu to shut
                                           while someone is reaching for it. */
                                        <div className="absolute left-0 top-full pt-1 w-52">
                                            <div className="rounded-xl bg-white border border-surface-200 shadow-xl py-1.5 overflow-hidden">
                                                {n.children.map(c => (
                                                    <Link
                                                        key={c.href}
                                                        href={c.href}
                                                        className={`block px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                                                            isActive(c.href)
                                                                ? 'text-brand-700 bg-brand-50'
                                                                : 'text-surface-600 hover:text-brand-700 hover:bg-surface-50'
                                                        }`}
                                                    >
                                                        {c.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
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
                            {NAV.map(n => n.children ? (
                                <div key={n.label} className="py-1">
                                    <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-surface-400">
                                        {n.label}
                                    </div>
                                    {n.children.map(c => (
                                        <Link
                                            key={c.href}
                                            href={c.href}
                                            className={`block pl-6 pr-3 py-2.5 rounded-lg text-sm font-semibold ${
                                                isActive(c.href) ? 'text-brand-700 bg-brand-50' : 'text-surface-700'
                                            }`}
                                        >
                                            {c.label}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
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
            <SiteFooter bitac={bitac} important={important} ministry={ministry} />
        </div>
    );
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
    const phone = bitac?.phone_bn || bitac?.phone;
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
                      fill="rgb(var(--brand-600, 98 49 155))" opacity="0.9" />
                <path d="M0,84 C230,40 430,114 720,82 C1010,50 1210,110 1440,72 L1440,120 L0,120 Z"
                      fill="rgb(var(--brand-950, 29 13 48))" />
            </svg>

            <div className="relative bg-brand-950 overflow-hidden">
                <div className="absolute inset-0 bg-blueprint opacity-70" />
                <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-brand-600/20 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-[28rem] h-[20rem] rounded-full bg-fuchsia-600/10 blur-3xl" />
                {/* A large gear turning slowly behind the columns — the site's
                    one motif, carried down from the hero. */}
                <svg viewBox="0 0 400 400" aria-hidden="true"
                     className="absolute -right-32 -bottom-40 w-[34rem] h-[34rem] opacity-[0.045] pointer-events-none">
                    <g className="gear-turn">
                        <path d={gearPath(200, 200, 190, 160, 18)} fill="white" fillRule="evenodd" />
                    </g>
                </svg>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* ── Reach us: the three ways in, before anything else ── */}
                    <div className="grid sm:grid-cols-3 gap-4 pt-14 pb-12 border-b border-white/10">
                        <ContactTile icon="fi-rr-phone-call" label="Call us" value={phone}
                                     href={bitac?.phone ? `tel:${bitac.phone.split(',')[0].replace(/[^\d+]/g, '')}` : undefined} />
                        <ContactTile icon="fi-rr-envelope" label="Email us" value={bitac?.email}
                                     href={bitac?.email ? `mailto:${bitac.email}` : undefined} />
                        <ContactTile icon="fi-rr-marker" label="Visit us" value={address} href="/portfolio/contact" internal />
                    </div>

                    {/* ── The columns ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-10 py-14">
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
                            <p className="text-[13px] leading-relaxed mt-5 max-w-sm">
                                An autonomous body under the Ministry of Industries, serving the
                                nation&rsquo;s industry with manufacturing, training, testing and
                                research since 1962.
                            </p>
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

function ContactTile({ icon, label, value, href, internal = false }: {
    icon: string; label: string; value?: string | null; href?: string; internal?: boolean;
}) {
    if (!value) return null;
    const body = (
        <>
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-black/25 group-hover:scale-105 transition-transform">
                <i className={`fi ${icon} text-lg leading-none`} />
            </span>
            <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.18em] font-bold text-brand-300">{label}</span>
                <span className="block text-sm font-semibold text-white mt-1 leading-snug break-words">{value}</span>
            </span>
        </>
    );
    const className = 'group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-brand-400/40 transition-all';

    if (!href) return <div className={className}>{body}</div>;
    return internal
        ? <Link href={href} className={className}>{body}</Link>
        : <a href={href} className={className}>{body}</a>;
}

function FooterColumn({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
    return (
        <div className={className}>
            <div className="flex items-center gap-2.5 mb-5">
                <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-brand-300 to-brand-500" />
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
