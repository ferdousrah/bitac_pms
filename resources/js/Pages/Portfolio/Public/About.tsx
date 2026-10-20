import PublicLayout from '@/Layouts/PublicLayout';
import { PageHead, Prose, Section, SectionHead, Stat } from './parts';

interface Props {
    stats: { years: number; projects: number; clients: number; centres: number };
    centres: { slug: string; name: string; sub: string | null; address: string | null; phone: string | null; email: string | null }[];
    bitac: any; site: any; links: any;
}

export default function About({ stats, centres, bitac, site, links }: Props) {
    return (
        <PublicLayout title="About BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="About us"
                title={bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)'}
                lead={site?.about_lead}
            />

            <Section>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-5">
                        <h2 className="text-2xl font-bold text-surface-900">Who we are</h2>
                        <p className="text-sm text-surface-700 leading-relaxed">{site?.about_lead}</p>
                        <Prose text={site?.about_body} className="text-sm text-surface-600 leading-[1.9]" />
                        <div className="rounded-2xl bg-brand-50 border border-brand-200 p-6">
                            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-700 mb-2">
                                Mission
                            </div>
                            <p className="text-sm text-surface-800 leading-relaxed">{site?.mission}</p>
                        </div>
                    </div>

                    <aside className="rounded-2xl border border-surface-200 p-6 h-fit">
                        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-600 mb-5">
                            At a glance
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Stat value={`${stats.years}+`} label="Years" />
                            <Stat value={stats.centres} label="Centres" />
                            <Stat value={stats.projects} label="Projects" />
                            <Stat value={`${stats.clients}+`} label="Clients" />
                        </div>
                    </aside>
                </div>
            </Section>

            <Section tint>
                <SectionHead
                    eyebrow="Nationwide"
                    title="Our centres"
                    lead="BITAC works from its Dhaka headquarters and its regional centres."
                />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {centres.map((c) => (
                        <div key={c.name} className="rounded-2xl bg-white border border-surface-200 p-5">
                            <div className="text-sm font-bold text-surface-900">{c.name}</div>
                            {c.sub && <div className="text-xs text-surface-500 mt-0.5">{c.sub}</div>}
                            {c.address && (
                                <div className="text-xs text-surface-600 mt-3 leading-relaxed">{c.address}</div>
                            )}
                            {c.phone && (
                                <div className="text-xs text-surface-500 mt-2">
                                    <i className="fi fi-rr-phone-call text-[10px] mr-1.5" />{c.phone}
                                </div>
                            )}
                            {c.email && (
                                <div className="text-xs text-surface-500 mt-1">
                                    <i className="fi fi-rr-envelope text-[10px] mr-1.5" />{c.email}
                                </div>
                            )}
                            <a href={`/portfolio/contact#${c.slug}`}
                               className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 mt-4">
                                <i className="fi fi-rr-map-marker text-[10px] leading-none" />
                                Map &amp; contacts
                            </a>
                        </div>
                    ))}
                </div>
            </Section>
        </PublicLayout>
    );
}
