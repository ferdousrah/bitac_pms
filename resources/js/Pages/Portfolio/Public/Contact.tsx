import PublicLayout, { BitacInfo, SiteLinkRow } from '@/Layouts/PublicLayout';
import { PageHead, Section, SectionHead } from './parts';

interface Centre {
    name: string;
    sub: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
}

interface Props {
    centres: Centre[];
    bitac: BitacInfo;
    site: { map_embed: string };
    links: Record<string, SiteLinkRow[]>;
}

export default function Contact({ centres, bitac, site, links }: Props) {
    const hq = bitac ?? ({} as BitacInfo);
    const website = hq.website
        ? (hq.website.startsWith('http') ? hq.website : `https://${hq.website}`)
        : undefined;

    return (
        <PublicLayout title="Contact — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="Get in touch"
                title="Contact BITAC"
                lead="Head office and the regional centres — write, call, or bring the drawing in."
            />

            <Section>
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Head office, said once and prominently — it is where
                        almost every enquiry should land. */}
                    <div className="lg:col-span-2 rounded-2xl border border-surface-200 overflow-hidden">
                        <div className="bg-brand-950 text-white px-6 py-5">
                            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-400">Head office</div>
                            <h2 className="text-lg font-bold mt-1">{hq.name_bn || hq.name_en}</h2>
                            {hq.name_bn && hq.name_en && (
                                <div className="text-xs text-surface-400 mt-0.5">{hq.name_en}</div>
                            )}
                        </div>
                        <dl className="divide-y divide-surface-200">
                            <Row icon="fi-rr-marker" label="Address" value={hq.address_bn || hq.address} />
                            <Row icon="fi-rr-phone-call" label="Phone" value={hq.phone_bn || hq.phone} />
                            <Row icon="fi-rr-envelope" label="Email" value={hq.email}
                                 href={hq.email ? `mailto:${hq.email}` : undefined} />
                            <Row icon="fi-rr-globe" label="Website" value={hq.website} href={website} />
                        </dl>
                    </div>

                    <div className="rounded-2xl bg-brand-50 border border-brand-200 p-6">
                        <h3 className="text-sm font-bold text-brand-900">Want a quotation?</h3>
                        <p className="text-xs text-brand-900/80 mt-2 leading-relaxed">
                            Send your drawing, sample or specification with the quantity you need.
                            BITAC prepares a costing and a formal quotation against it.
                        </p>
                        {hq.email && (
                            <a href={`mailto:${hq.email}?subject=Request%20for%20Quotation`}
                               className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors">
                                <i className="fi fi-rr-envelope text-xs leading-none" />
                                Email your enquiry
                            </a>
                        )}
                        <div className="mt-6 pt-5 border-t border-brand-200">
                            <h3 className="text-sm font-bold text-brand-900">Already a client?</h3>
                            <p className="text-xs text-brand-900/80 mt-2 leading-relaxed">
                                Track your jobs, quotations, bills and deliveries in the customer portal.
                            </p>
                            <a href="/customer/login"
                               className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-surface-50 border border-brand-300 text-brand-800 text-sm font-semibold transition-colors">
                                <i className="fi fi-rr-user text-xs leading-none" />
                                Customer login
                            </a>
                        </div>
                    </div>
                </div>
            </Section>

            {centres.length > 1 && (
                <Section tint>
                    <SectionHead
                        eyebrow="Across the country"
                        title="Regional centres"
                        lead="BITAC works from six centres. Each one takes work in its own region."
                    />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {centres.map((c) => (
                            <div key={c.name} className="rounded-2xl bg-white border border-surface-200 p-5">
                                <h3 className="text-sm font-bold text-surface-900 leading-snug">{c.name}</h3>
                                {c.sub && <div className="text-[11px] text-surface-500 mt-0.5">{c.sub}</div>}
                                <div className="mt-3 space-y-1.5 text-xs text-surface-600 leading-relaxed">
                                    {c.address && (
                                        <div><i className="fi fi-rr-marker text-[10px] mr-1.5 text-surface-400" />{c.address}</div>
                                    )}
                                    {c.phone && (
                                        <div><i className="fi fi-rr-phone-call text-[10px] mr-1.5 text-surface-400" />{c.phone}</div>
                                    )}
                                    {c.email && (
                                        <div>
                                            <i className="fi fi-rr-envelope text-[10px] mr-1.5 text-surface-400" />
                                            <a href={`mailto:${c.email}`} className="hover:text-brand-700 break-all">{c.email}</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* The admin types a map URL. It is used ONLY as an iframe src,
                never rendered as HTML, so a pasted script tag cannot reach a
                visitor. */}
            {site?.map_embed && (
                <section className="bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
                        <div className="rounded-2xl overflow-hidden border border-surface-200 aspect-[21/9]">
                            <iframe
                                src={site.map_embed}
                                title="BITAC location"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                </section>
            )}
        </PublicLayout>
    );
}

function Row({ icon, label, value, href }: {
    icon: string; label: string; value?: string | null; href?: string;
}) {
    if (!value) return null;
    return (
        <div className="flex gap-4 px-6 py-4">
            <span className="w-9 h-9 rounded-lg bg-surface-100 text-surface-500 flex items-center justify-center shrink-0">
                <i className={`fi ${icon} text-sm leading-none`} />
            </span>
            <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wider font-bold text-surface-400">{label}</dt>
                <dd className="text-sm text-surface-800 mt-0.5 leading-relaxed break-words">
                    {href ? <a href={href} className="hover:text-brand-700">{value}</a> : value}
                </dd>
            </div>
        </div>
    );
}
