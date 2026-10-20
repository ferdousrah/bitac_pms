import { useEffect, useMemo, useRef, useState } from 'react';
import PublicLayout, { BitacInfo, SiteLinkRow } from '@/Layouts/PublicLayout';
import { PageHead, Section } from './parts';

interface OfficeContact {
    id: number;
    name: string | null;
    designation: string;
    phone: string | null;
    mobile: string | null;
    email: string | null;
}

interface Office {
    id: number;
    slug: string;
    name: string;
    address: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
    is_head_office: boolean;
    map_embed_url: string;
    map_link: string;
    contacts: OfficeContact[];
}

interface Props {
    offices: Office[];
    bitac: BitacInfo;
    links: Record<string, SiteLinkRow[]>;
}

/**
 * A phone field can hold several numbers ("০২-৫৫০৩০০৫৭, ০২-৫৫০৩০০৪৬"), and is
 * typed in Bangla digits. ⚠️ A `tel:` link with Bangla digits dials nothing, so
 * each number keeps its Bangla face on screen and gets an ASCII href.
 */
const BN = '০১২৩৪৫৬৭৮৯';
function telHref(n: string): string {
    const ascii = n.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
    return 'tel:' + ascii.replace(/[^\d+]/g, '');
}
function splitNumbers(v?: string | null): string[] {
    return (v ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

export default function Contact({ offices, bitac, links }: Props) {
    // The office in view. Read from the #hash so a link to /portfolio/contact#khulna
    // opens on Khulna, and kept in it so the view can be shared.
    const initial = useMemo(() => offices.find((o) => o.is_head_office)?.slug ?? offices[0]?.slug ?? '', [offices]);
    const [slug, setSlug] = useState(initial);
    const mapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fromHash = decodeURIComponent(window.location.hash.replace('#', ''));
        if (offices.some((o) => o.slug === fromHash)) setSlug(fromHash);
    }, [offices]);

    const choose = (s: string) => {
        setSlug(s);
        window.history.replaceState(null, '', `#${s}`);
        // On a phone the map is below the list — bring it into view, or the
        // tap looks like it did nothing.
        if (window.matchMedia('(max-width: 1023px)').matches) {
            mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const office = offices.find((o) => o.slug === slug) ?? offices[0];
    const headOffice = offices.find((o) => o.is_head_office);

    return (
        <PublicLayout title="Contact — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="Get in touch"
                title="Contact BITAC"
                lead="Our head office and regional centres — pick one to see it on the map, with the people to talk to."
            />

            <Section>
                {offices.length === 0 ? (
                    <p className="text-sm text-surface-500">Contact details will be published here shortly.</p>
                ) : (
                    /* ⚠️ grid-cols-1, not a bare `grid`: with no template the one
                       mobile column sizes itself to its widest unbreakable child —
                       a `truncate`d office name — and pushed the page past 390px. */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* ── The offices ─────────────────────────────────
                            Sticky on a wide screen: the details beside it are
                            much taller, and a list that scrolls away left a
                            block of empty page under itself. */}
                        <aside className="lg:col-span-4 lg:sticky lg:top-24">
                            <div className="rounded-3xl border border-surface-200 bg-surface-50/70 p-2">
                                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                                    <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-surface-600">Our offices</span>
                                    <span className="text-[11px] font-bold text-surface-400 tabular-nums">{offices.length}</span>
                                </div>
                                <div className="space-y-1">
                                    {offices.map((o) => {
                                        const on = o.slug === office?.slug;
                                        return (
                                            <button
                                                key={o.slug}
                                                type="button"
                                                onClick={() => choose(o.slug)}
                                                aria-pressed={on}
                                                className={`group relative w-full text-left flex items-center gap-3.5 px-3 py-3 rounded-2xl transition-all ${
                                                    on ? 'bg-white ring-1 ring-surface-300' : 'hover:bg-white/70'
                                                }`}
                                            >
                                                {/* The selected office is marked by a bar on its
                                                    edge — quieter than a coloured border round the
                                                    whole card, which competed with the map. */}
                                                <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-transparent'}`} />
                                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                    on ? 'bg-brand-600 text-white'
                                                       : 'bg-white border border-surface-200 text-surface-400 group-hover:text-brand-600'
                                                }`}>
                                                    <i className={`fi ${o.is_head_office ? 'fi-rr-building' : 'fi-rr-marker'} text-sm leading-none`} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold leading-snug truncate ${on ? 'text-surface-900' : 'text-surface-700'}`}>
                                                            {o.name}
                                                        </span>
                                                        {o.is_head_office && (
                                                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                                HQ
                                                            </span>
                                                        )}
                                                    </span>
                                                    {o.address && (
                                                        <span className="block text-[13px] text-surface-600 mt-0.5 truncate">{o.address}</span>
                                                    )}
                                                </span>
                                                <i className={`fi fi-rr-angle-small-right text-base leading-none shrink-0 transition-all ${
                                                    on ? 'text-brand-600' : 'text-surface-300 group-hover:text-surface-500 group-hover:translate-x-0.5'
                                                }`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* The question most visitors arrive with, answered
                                beside the list rather than left as empty page. */}
                            {headOffice && (
                                <div className="mt-4 rounded-3xl bg-ink-900 bg-blueprint text-white p-6 relative overflow-hidden">
                                    <div className="relative">
                                        <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-amber-300">Not sure which centre?</div>
                                        <p className="text-sm text-white/90 mt-2 leading-relaxed">
                                            Write to the head office — your enquiry will reach the centre that can take the job.
                                        </p>
                                        <div className="mt-4 space-y-2">
                                            {headOffice.email && (
                                                <a href={`mailto:${headOffice.email}`}
                                                   className="flex items-center gap-2.5 text-sm font-semibold text-white hover:text-amber-200 transition-colors break-all">
                                                    <i className="fi fi-rr-envelope text-xs leading-none text-amber-300" />{headOffice.email}
                                                </a>
                                            )}
                                            {splitNumbers(headOffice.phone).slice(0, 1).map((n) => (
                                                <a key={n} href={telHref(n)}
                                                   className="flex items-center gap-2.5 text-sm font-semibold text-white hover:text-amber-200 transition-colors">
                                                    <i className="fi fi-rr-phone-call text-xs leading-none text-amber-300" />{n}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>

                        {/* ── The chosen office ──────────────────────────── */}
                        {office && (
                            <div ref={mapRef} className="lg:col-span-8 scroll-mt-28 space-y-6">
                                {/* One card: the map and everything needed to reach
                                    the office. Address, phone, email and fax used to be
                                    four separate boxes — and fax, the fourth, sat alone
                                    in half a row. */}
                                <div className="rounded-3xl overflow-hidden border border-surface-200 bg-white">
                                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-lg font-bold text-surface-900 truncate">{office.name}</h2>
                                                {office.is_head_office && (
                                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                        Head office
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <a href={office.map_link} target="_blank" rel="noopener noreferrer"
                                           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
                                            <i className="fi fi-rr-route text-xs leading-none" />
                                            Get directions
                                        </a>
                                    </div>

                                    {/* Keyed on the office, so choosing another one
                                        loads its map rather than keeping the last. */}
                                    <div className="relative aspect-[16/9] bg-surface-100 border-y border-surface-200">
                                        <iframe
                                            key={office.slug}
                                            src={office.map_embed_url}
                                            title={`Map — ${office.name}`}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            className="absolute inset-0 w-full h-full border-0"
                                        />
                                    </div>

                                    <OfficeInfo office={office} />
                                </div>

                                <People contacts={office.contacts} />
                            </div>
                        )}
                    </div>
                )}
            </Section>

            {/* ── The two things most visitors came for ─────────────── */}
            <Section tint>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-3xl bg-white border border-surface-200 p-7">
                        <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                            <i className="fi fi-rr-paper-plane text-lg leading-none" />
                        </span>
                        <h3 className="text-lg font-bold text-surface-900 mt-5">Want a quotation?</h3>
                        <p className="text-sm text-surface-600 mt-2 leading-relaxed">
                            Send your drawing, sample or specification with the quantity you need, to the centre
                            nearest you. BITAC prepares a costing and a formal quotation against it.
                        </p>
                        {office?.email && (
                            <a href={`mailto:${office.email}?subject=Request%20for%20Quotation`}
                               className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
                                <i className="fi fi-rr-envelope text-xs leading-none" />
                                Email {office.name}
                            </a>
                        )}
                    </div>
                    <div className="rounded-3xl bg-white border border-surface-200 p-7">
                        <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <i className="fi fi-rr-briefcase text-lg leading-none" />
                        </span>
                        <h3 className="text-lg font-bold text-surface-900 mt-5">Already a client?</h3>
                        <p className="text-sm text-surface-600 mt-2 leading-relaxed">
                            Track your jobs, quotations, bills and deliveries in the customer portal.
                        </p>
                        <a href="/customer/login"
                           className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-surface-300 hover:border-brand-400 hover:bg-brand-50 text-surface-700 hover:text-brand-700 text-sm font-bold transition-colors">
                            <i className="fi fi-rr-user text-xs leading-none" />
                            Customer login
                        </a>
                    </div>
                </div>
            </Section>
        </PublicLayout>
    );
}

/**
 * Address on its own line, then phone / email / fax sharing ONE row equally —
 * however many of them the office has. A fixed two-column grid left the odd
 * one out alone in half a row (fax at Bogura, phone at Khulna).
 */
const COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

function OfficeInfo({ office }: { office: Office }) {
    const cells: React.ReactNode[] = [];
    if (office.phone) cells.push(<InfoRow key="p" icon="fi-rr-phone-call" label="Phone"><Numbers value={office.phone} /></InfoRow>);
    if (office.email) cells.push(
        <InfoRow key="e" icon="fi-rr-envelope" label="Email">
            <a href={`mailto:${office.email}`} className="hover:text-brand-700 break-all">{office.email}</a>
        </InfoRow>,
    );
    if (office.fax) cells.push(<InfoRow key="f" icon="fi-rr-print" label="Fax">{office.fax}</InfoRow>);

    return (
        <dl>
            {office.address && (
                <InfoRow icon="fi-rr-marker" label="Address" className={cells.length ? 'border-b border-surface-100' : ''}>
                    {office.address}
                </InfoRow>
            )}
            {cells.length > 0 && (
                <div className={`grid grid-cols-1 ${COLS[cells.length]} divide-y sm:divide-y-0 sm:divide-x divide-surface-100`}>
                    {cells}
                </div>
            )}
        </dl>
    );
}

function InfoRow({ icon, label, className = '', children }: {
    icon: string; label: string; className?: string; children: React.ReactNode;
}) {
    return (
        <div className={`flex gap-4 px-6 py-4 ${className}`}>
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <i className={`fi ${icon} text-sm leading-none`} />
            </span>
            <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-[0.14em] font-bold text-surface-500">{label}</dt>
                <dd className="text-[15px] text-surface-900 mt-0.5 leading-relaxed">{children}</dd>
            </div>
        </div>
    );
}

/** Several numbers in one field, each its own tappable link. */
function Numbers({ value }: { value: string }) {
    return (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
            {splitNumbers(value).map((n) => (
                <a key={n} href={telHref(n)} className="hover:text-brand-700 whitespace-nowrap">{n}</a>
            ))}
        </span>
    );
}

/**
 * Who to contact.
 *
 * ⚠️ Two kinds of contact, shown two ways. A NAMED person — the centre head,
 * with a mobile — is who most visitors want, so they get a featured card. A
 * POST with only its official email is a line in a list: as a card it was a
 * big box with a grey placeholder icon and one line of text, and a row of
 * those next to the head's tall card is what made the section look ragged.
 */
function People({ contacts }: { contacts: OfficeContact[] }) {
    if (!contacts.length) return null;
    const named = contacts.filter((c) => c.name);
    const posts = contacts.filter((c) => !c.name);

    return (
        <div className="rounded-3xl border border-surface-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-2.5">
                <span className="w-1.5 h-4 rounded-full bg-brand-600" />
                <h3 className="text-base font-bold text-surface-900">Who to contact</h3>
            </div>

            {named.length > 0 && (
                <div className="p-4 sm:p-5 grid gap-3">
                    {named.map((c) => <PersonCard key={c.id} c={c} />)}
                </div>
            )}

            {posts.length > 0 && (
                <ul className={`divide-y divide-surface-100 ${named.length ? 'border-t border-surface-100' : ''}`}>
                    {posts.map((c) => (
                        <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-6 px-6 py-3.5 hover:bg-surface-50/70 transition-colors">
                            <span className="sm:w-1/2 text-[15px] font-semibold text-surface-900 leading-snug">{c.designation}</span>
                            <span className="sm:flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                                {c.email && (
                                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 hover:underline break-all">
                                        <i className="fi fi-rr-envelope text-[11px] leading-none" />{c.email}
                                    </a>
                                )}
                                {splitNumbers(c.mobile).map((n) => (
                                    <a key={'m' + n} href={telHref(n)} className="inline-flex items-center gap-1.5 text-sm text-surface-900 hover:text-brand-700 whitespace-nowrap">
                                        <i className="fi fi-rr-mobile-notch text-[11px] leading-none text-surface-400" />{n}
                                    </a>
                                ))}
                                {splitNumbers(c.phone).map((n) => (
                                    <a key={'p' + n} href={telHref(n)} className="inline-flex items-center gap-1.5 text-sm text-surface-800 hover:text-brand-700 whitespace-nowrap">
                                        <i className="fi fi-rr-phone-call text-[11px] leading-none text-surface-400" />{n}
                                    </a>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PersonCard({ c }: { c: OfficeContact }) {
    // ⚠️ Flat on purpose (BITAC): no initial badge, no gradient wash, no
    // shadow. The name and the numbers are the content; anything drawn round
    // them only made the Bangla type softer to read.
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-white border border-surface-200">
            <div className="sm:w-1/2 min-w-0">
                <div className="text-base font-bold text-surface-900 leading-snug">{c.name}</div>
                <div className="text-sm text-surface-700 mt-0.5 leading-snug">{c.designation}</div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-1 sm:justify-end">
                {splitNumbers(c.mobile).map((n) => (
                    <a key={'m' + n} href={telHref(n)}
                       className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors whitespace-nowrap">
                        <i className="fi fi-rr-mobile-notch text-xs leading-none" />{n}
                    </a>
                ))}
                {splitNumbers(c.phone).map((n) => (
                    <a key={'p' + n} href={telHref(n)}
                       className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-surface-300 hover:border-brand-400 text-surface-900 text-sm font-semibold transition-colors whitespace-nowrap">
                        <i className="fi fi-rr-phone-call text-xs leading-none text-surface-600" />{n}
                    </a>
                ))}
                {c.email && (
                    <a href={`mailto:${c.email}`}
                       className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-surface-300 hover:border-brand-400 text-surface-900 text-sm font-semibold transition-colors break-all">
                        <i className="fi fi-rr-envelope text-xs leading-none text-surface-600" />{c.email}
                    </a>
                )}
            </div>
        </div>
    );
}
