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
                    <div className="grid lg:grid-cols-12 gap-8 items-start">
                        {/* ── The offices ─────────────────────────────── */}
                        <div className="lg:col-span-4">
                            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-4 flex items-center gap-2.5">
                                <span className="h-px w-8 bg-brand-500" />
                                {offices.length} offices
                            </div>
                            <div className="space-y-3">
                                {offices.map((o) => {
                                    const on = o.slug === office?.slug;
                                    return (
                                        <button
                                            key={o.slug}
                                            type="button"
                                            onClick={() => choose(o.slug)}
                                            aria-pressed={on}
                                            className={`group w-full text-left flex gap-4 p-4 rounded-2xl border transition-all ${
                                                on
                                                    ? 'bg-white border-brand-400 shadow-lg shadow-brand-500/10 ring-1 ring-brand-400'
                                                    : 'bg-surface-50 border-surface-200 hover:bg-white hover:border-surface-300'
                                            }`}
                                        >
                                            <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                on ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-white border border-surface-200 text-surface-400 group-hover:text-brand-600'
                                            }`}>
                                                <i className={`fi ${o.is_head_office ? 'fi-rr-building' : 'fi-rr-marker'} text-base leading-none`} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[15px] font-bold leading-snug ${on ? 'text-surface-900' : 'text-surface-700'}`}>
                                                        {o.name}
                                                    </span>
                                                    {o.is_head_office && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                            Head office
                                                        </span>
                                                    )}
                                                </span>
                                                {o.address && (
                                                    <span className="block text-xs text-surface-500 mt-1 leading-relaxed line-clamp-2">{o.address}</span>
                                                )}
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2 ${on ? 'text-brand-700' : 'text-surface-400 group-hover:text-brand-600'}`}>
                                                    <i className="fi fi-rr-map-marker text-[10px] leading-none" />
                                                    {on ? 'Showing on the map' : 'Show on the map'}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── The chosen office: map, details, people ── */}
                        {office && (
                            <div ref={mapRef} className="lg:col-span-8 scroll-mt-28 space-y-6">
                                <div className="rounded-3xl overflow-hidden border border-surface-200 bg-white shadow-xl shadow-surface-900/5">
                                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-surface-200">
                                        <div className="min-w-0">
                                            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-600">On the map</div>
                                            <div className="text-base font-bold text-surface-900 truncate">{office.name}</div>
                                        </div>
                                        <a href={office.map_link} target="_blank" rel="noopener noreferrer"
                                           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition-all">
                                            <i className="fi fi-rr-route text-xs leading-none" />
                                            Directions
                                        </a>
                                    </div>
                                    {/* Keyed on the office, so choosing another one
                                        loads its map rather than keeping the last. */}
                                    <div className="relative aspect-[16/10] bg-surface-100">
                                        <iframe
                                            key={office.slug}
                                            src={office.map_embed_url}
                                            title={`Map — ${office.name}`}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            className="absolute inset-0 w-full h-full border-0"
                                        />
                                    </div>
                                </div>

                                {/* Office details */}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {office.address && (
                                        <Detail icon="fi-rr-marker" label="Address" wide>
                                            {office.address}
                                        </Detail>
                                    )}
                                    {office.phone && (
                                        <Detail icon="fi-rr-phone-call" label="Phone">
                                            <Numbers value={office.phone} />
                                        </Detail>
                                    )}
                                    {office.email && (
                                        <Detail icon="fi-rr-envelope" label="Email">
                                            <a href={`mailto:${office.email}`} className="hover:text-brand-700 break-all">{office.email}</a>
                                        </Detail>
                                    )}
                                    {office.fax && (
                                        <Detail icon="fi-rr-print" label="Fax">{office.fax}</Detail>
                                    )}
                                </div>

                                {/* Contact persons */}
                                {office.contacts.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-4">
                                            <span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
                                            <h2 className="text-lg font-bold text-surface-900">Who to contact</h2>
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            {office.contacts.map((c) => <ContactCard key={c.id} c={c} />)}
                                        </div>
                                    </div>
                                )}
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
                               className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-sm font-bold transition-all">
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

function Detail({ icon, label, wide = false, children }: {
    icon: string; label: string; wide?: boolean; children: React.ReactNode;
}) {
    return (
        <div className={`flex gap-4 p-5 rounded-2xl bg-surface-50 border border-surface-200 ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="w-10 h-10 rounded-xl bg-white border border-surface-200 text-brand-600 flex items-center justify-center shrink-0">
                <i className={`fi ${icon} text-sm leading-none`} />
            </span>
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-surface-400">{label}</div>
                <div className="text-sm text-surface-800 mt-1 leading-relaxed">{children}</div>
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

function ContactCard({ c }: { c: OfficeContact }) {
    // Initial when there is a name; otherwise the post IS the contact, and an
    // icon says so rather than inventing a monogram.
    const initial = c.name
        ? c.name.replace(/^(জনাব|জনাবা|ড\.|Dr\.?|Mr\.?|Ms\.?|Engr\.?)\s*/u, '').replace(/^মোঃ\s*/u, '').trim().slice(0, 1)
        : null;

    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-white border border-surface-200 hover:border-brand-200 hover:shadow-md transition-all">
            <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                c.name ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white text-lg font-bold' : 'bg-surface-100 text-surface-400'
            }`}>
                {initial ?? <i className="fi fi-rr-id-badge text-base leading-none" />}
            </span>
            <div className="min-w-0 flex-1">
                {c.name && <div className="text-sm font-bold text-surface-900 leading-snug">{c.name}</div>}
                <div className={`leading-snug ${c.name ? 'text-xs text-surface-500 mt-0.5' : 'text-sm font-semibold text-surface-800'}`}>
                    {c.designation}
                </div>
                <div className="mt-2.5 space-y-1.5">
                    {splitNumbers(c.mobile).map((n) => (
                        <a key={'m' + n} href={telHref(n)}
                           className="flex items-center gap-2 text-[13px] font-semibold text-surface-700 hover:text-brand-700">
                            <i className="fi fi-rr-mobile-notch text-xs leading-none text-brand-500" />{n}
                        </a>
                    ))}
                    {splitNumbers(c.phone).map((n) => (
                        <a key={'p' + n} href={telHref(n)}
                           className="flex items-center gap-2 text-[13px] text-surface-600 hover:text-brand-700">
                            <i className="fi fi-rr-phone-call text-xs leading-none text-surface-400" />{n}
                        </a>
                    ))}
                    {c.email && (
                        <a href={`mailto:${c.email}`}
                           className="flex items-center gap-2 text-[13px] text-surface-600 hover:text-brand-700 break-all">
                            <i className="fi fi-rr-envelope text-xs leading-none text-surface-400" />{c.email}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
