import { Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, PageHead, Section, SectionHead } from './parts';

export interface ServiceRow {
    id: number;
    title: string;
    summary: string | null;
    body: string | null;
    icon_class: string;
    image_url: string | null;
}

interface Props {
    services: ServiceRow[];
    stats: { years: number; projects: number; clients: number; centres: number };
    bitac: any; site: any; links: any;
}

export default function Services({ services, stats, bitac, links }: Props) {
    return (
        <PublicLayout title="Services — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="What we do"
                title="Our services"
                lead="Manufacturing, training, testing and development — for government bodies and private industry alike."
            />

            <Section>
                {services.length ? (
                    <div className="grid sm:grid-cols-2 gap-6">
                        {services.map((s) => (
                            <article key={s.id} className="rounded-2xl bg-white border border-surface-200 overflow-hidden hover:border-brand-300 hover:shadow-lg transition-all">
                                {s.image_url && (
                                    <div className="aspect-[16/9] bg-surface-100">
                                        <img src={s.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-6">
                                    <span className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                                        <i className={`fi ${s.icon_class} text-lg leading-none`} />
                                    </span>
                                    <h2 className="text-lg font-bold text-surface-900 leading-snug">{s.title}</h2>
                                    {s.summary && (
                                        <p className="text-sm text-surface-600 mt-3 leading-relaxed">{s.summary}</p>
                                    )}
                                    {s.body && (
                                        // Text, not HTML — see NewsShow. This is a
                                        // public page and nothing here is sanitised
                                        // on the way in.
                                        <p className="text-sm text-surface-600 mt-3 leading-relaxed whitespace-pre-line">
                                            {s.body}
                                        </p>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <Empty icon="fi-rr-tools" title="No services listed yet"
                           text="Services added under Admin → Website appear here." />
                )}
            </Section>

            <Section tint>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                    <div>
                        <SectionHead
                            eyebrow="Why BITAC"
                            title="A government workshop with industry's deadlines"
                            lead="Six centres, six decades of import-substitute manufacturing, and a costing anyone can audit."
                        />
                        <div className="grid grid-cols-2 gap-6 max-w-md">
                            {[
                                [`${stats.years}+`, 'Years of service'],
                                [stats.centres, 'Centres nationwide'],
                                [`${stats.clients}+`, 'Clients served'],
                                [stats.projects, 'Products on display'],
                            ].map(([v, l]) => (
                                <div key={String(l)}>
                                    <div className="text-3xl font-extrabold text-surface-900 tabular-nums">{v}</div>
                                    <div className="text-[11px] text-surface-500 mt-1 uppercase tracking-wider font-semibold">{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-surface-200 p-7">
                        <h3 className="text-base font-bold text-surface-900">How a job runs</h3>
                        <p className="text-sm text-surface-600 mt-2 leading-relaxed">
                            The same route for every job, whoever the client is.
                        </p>
                        <ol className="mt-5 space-y-3.5">
                            {[
                                ['Enquiry', 'Send the drawing, sample or specification with the quantity.'],
                                ['Costing & quotation', 'BITAC prices the work part by part and issues a formal quotation.'],
                                ['Work order', 'Your work order is accepted and the job is planned and routed to the shops.'],
                                ['Production & QC', 'Machining, fabrication and finishing, inspected before it leaves.'],
                                ['Delivery & bill', 'Delivery challan, then the bill and the মূসক ৬.৩ tax challan.'],
                            ].map(([step, text], i) => (
                                <li key={step} className="flex gap-3.5">
                                    <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <div className="text-sm font-bold text-surface-900">{step}</div>
                                        <div className="text-xs text-surface-600 mt-0.5 leading-relaxed">{text}</div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <Link href="/portfolio/request-quotation" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition-colors">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                Send an enquiry
                            </Link>
                            <Link href="/portfolio/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
                                See what we make
                                <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                            </Link>
                        </div>
                    </div>
                </div>
            </Section>
        </PublicLayout>
    );
}
