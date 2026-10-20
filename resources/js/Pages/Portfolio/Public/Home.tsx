import { Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import {
    GalleryRow, KindBadge, NewsRow, PartnerRow, PartnerWall, Project, ProjectCard, Prose, Section, SectionHead,
} from './parts';
import HeroSlider, { HeroSlide } from '@/Components/Public/HeroSlider';
import { ServiceRow } from './Services';

interface Stats { years: number; projects: number; clients: number; centres: number }

interface Props {
    slides: HeroSlide[];
    featured: Project[];
    services: ServiceRow[];
    news: NewsRow[];
    events: NewsRow[];
    photos: GalleryRow[];
    clients: { name: string; type: string | null }[];
    partners: PartnerRow[];
    stats: Stats;
    bitac: any;
    site: any;
    links: any;
}

/**
 * BITAC's front page.
 *
 * ⚠️ Every section past the hero renders ONLY when it has something in it. An
 * "Empty" box is honest inside the admin; on the public front page it reads as
 * a site that was never finished. The admin screen is where emptiness is
 * explained.
 *
 * The rhythm is deliberate — dark, light, dark, light — because a run of white
 * sections with white cards in them was what made this page read as plain.
 */
export default function Home({ slides, featured, services, news, events, photos, clients, partners, stats, bitac, site, links }: Props) {
    return (
        <PublicLayout title="BITAC — Bangladesh Industrial Technical Assistance Centre" bitac={bitac} links={links}>
            {/* ── Hero ─────────────────────────────────────────────────── */}
            {slides.length > 0 ? (
                <HeroSlider slides={slides} fallbackTitle={site?.hero_title} fallbackSubtitle={site?.hero_subtitle}>
                    <StatsStrip stats={stats} />
                </HeroSlider>
            ) : (
                <EngineeringHero site={site} stats={stats} bitac={bitac} services={services} />
            )}

            {/* ── About ────────────────────────────────────────────────── */}
            <Section>
                <div className="grid lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-7">
                        <SectionHead eyebrow="About BITAC" title="A national centre for industrial capability" />
                        <p className="text-base text-surface-800 leading-[1.8] font-medium">{site?.about_lead}</p>
                        <Prose text={site?.about_body} className="text-[15px] text-surface-600 leading-[1.85] mt-5" />
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <PrimaryButton href="/portfolio/about">Read more about BITAC</PrimaryButton>
                            <GhostButton href="/portfolio/contact" icon="fi-rr-envelope">Talk to us</GhostButton>
                        </div>
                    </div>

                    {/* The mission card is dark on purpose — the one block of
                        contrast in an otherwise white section. */}
                    <div className="lg:col-span-5 relative">
                        <div className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-brand-200 via-brand-100 to-transparent blur-2xl opacity-70" />
                        {/* pb-16, not p-8 all round: the years badge hangs off the
                            bottom-left corner, and at p-8 it sat on top of the last
                            service in the list. */}
                        <div className="relative rounded-3xl bg-brand-950 bg-blueprint text-white px-8 pt-8 pb-8 sm:pb-16 overflow-hidden shadow-2xl shadow-brand-900/30">
                            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-500/30 blur-3xl" />
                            <i className="fi fi-rr-quote-right absolute top-6 right-7 text-5xl text-white/10 leading-none" />
                            <div className="relative">
                                <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-300">Our mission</div>
                                <p className="text-lg leading-relaxed mt-3 text-white/90 font-medium">{site?.mission}</p>

                                {services.length > 0 && (
                                    <div className="mt-7 pt-6 border-t border-white/10 space-y-2.5">
                                        {services.map(x => (
                                            <Link key={x.id} href="/portfolio/services"
                                                  className="group flex items-center gap-3 text-sm text-white/75 hover:text-white transition-colors">
                                                <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-brand-500 flex items-center justify-center shrink-0 transition-colors">
                                                    <i className={`fi ${x.icon_class} text-sm leading-none`} />
                                                </span>
                                                <span className="font-medium">{x.title}</span>
                                                <i className="fi fi-rr-arrow-small-right ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 rounded-2xl bg-white shadow-xl shadow-surface-900/10 border border-surface-100 px-5 py-4">
                            <span className="text-3xl font-extrabold text-brand-600 tabular-nums">{stats.years}+</span>
                            <span className="text-[11px] leading-tight font-semibold text-surface-500 uppercase tracking-wider">
                                years serving<br />the nation
                            </span>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ── Services — the dark band ─────────────────────────────── */}
            {services.length > 0 && (
                <section className="relative overflow-hidden bg-brand-950 bg-blueprint">
                    <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] rounded-full bg-brand-600/20 blur-3xl -translate-y-1/2" />
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
                        <SectionHead dark eyebrow="What we do" title="Services under one roof"
                                     lead="From a single spare part to a training programme — manufacturing, skills, testing and development for government and private industry."
                                     action={{ href: '/portfolio/services', label: 'All services' }} />
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {services.map((x, i) => (
                                <Link key={x.id} href="/portfolio/services"
                                      className="group relative flex flex-col p-7 rounded-3xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-brand-400/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                                    <span className="absolute -top-2 right-4 text-7xl font-extrabold text-white/[0.04] group-hover:text-brand-400/10 tabular-nums transition-colors select-none">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-900/50 group-hover:scale-110 transition-transform duration-300">
                                        <i className={`fi ${x.icon_class} text-xl leading-none`} />
                                    </span>
                                    <h3 className="relative text-base font-bold text-white leading-snug mt-6">{x.title}</h3>
                                    {x.summary && (
                                        <p className="relative text-[13px] text-white/60 mt-3 leading-relaxed line-clamp-4">{x.summary}</p>
                                    )}
                                    <span className="relative inline-flex items-center gap-1.5 text-xs font-bold text-brand-300 mt-auto pt-5 group-hover:gap-2.5 transition-all">
                                        Learn more <i className="fi fi-rr-arrow-small-right text-sm leading-none" />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── How a job runs ───────────────────────────────────────── */}
            <Section>
                <SectionHead center eyebrow="How we work" title="From your drawing to delivery"
                             lead="The same route for every job, whoever the client is — and every figure behind a quotation can be shown." />
                <Process />
            </Section>

            {/* ── Products ─────────────────────────────────────────────── */}
            {featured.length > 0 && (
                <Section tint>
                    <SectionHead eyebrow="What we make" title="Manufactured products & recent work"
                                 lead="Precision components and overhaul work delivered for Railway, power, sugar and private industry."
                                 action={{ href: '/portfolio/products', label: 'All products' }} />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {featured.map(p => <ProjectCard key={p.id} p={p} />)}
                    </div>
                </Section>
            )}

            {/* ── News & events ────────────────────────────────────────── */}
            {(news.length > 0 || events.length > 0) && (
                <Section>
                    <div className={`grid gap-10 ${events.length ? 'lg:grid-cols-3' : ''}`}>
                        {news.length > 0 && (
                            <div className={events.length ? 'lg:col-span-2' : ''}>
                                <SectionHead eyebrow="Newsroom" title="News & notices"
                                             action={{ href: '/portfolio/news', label: 'All news' }} />
                                <NewsLayout news={news} />
                            </div>
                        )}
                        {events.length > 0 && (
                            <div>
                                <SectionHead eyebrow="Diary" title="Upcoming events" />
                                <div className="space-y-3">
                                    {events.map(e => <EventRow key={e.slug} e={e} />)}
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            )}

            {/* ── Clients — a moving wall ──────────────────────────────── */}
            {clients.length > 0 && (
                <section className="bg-white py-20 sm:py-24 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <SectionHead center eyebrow="Who we serve" title="Trusted by government and industry"
                                     lead={`${stats.clients}+ organisations bring their work to BITAC — from national utilities to private manufacturers.`} />
                    </div>
                    <ClientMarquee clients={clients} />
                    <div className="text-center mt-10">
                        <GhostButton href="/portfolio/clients" icon="fi-rr-building">See all clients</GhostButton>
                    </div>
                </section>
            )}

            {/* ── Collaborators & partners ─────────────────────────────── */}
            {partners.length > 0 && (
                <Section tint>
                    <SectionHead eyebrow="Who we work with" title="Collaborators & partners"
                                 lead="Ministries, institutions and technical partners BITAC works alongside." />
                    <PartnerWall partners={partners} />
                </Section>
            )}

            {/* ── Gallery ──────────────────────────────────────────────── */}
            {photos.length > 0 && (
                <Section>
                    <SectionHead eyebrow="Gallery" title="Inside BITAC"
                                 action={{ href: '/portfolio/gallery', label: 'Photo gallery' }} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {photos.slice(0, 8).map((g, i) => (
                            <Link key={g.id} href="/portfolio/gallery"
                                  className={`group relative rounded-2xl overflow-hidden bg-surface-100 ${i === 0 ? 'md:col-span-2 md:row-span-2 aspect-square' : 'aspect-square'}`}>
                                {g.image_url && (
                                    <img src={g.image_url} alt={g.title ?? ''} loading="lazy"
                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                )}
                                <span className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            {/* ── Call to action ───────────────────────────────────────── */}
            <CallToAction bitac={bitac} />
        </PublicLayout>
    );
}

// ── The hero, when no slides have been uploaded ─────────────────────────

/**
 * ⚠️ Drawn, not photographed. BITAC has not uploaded hero imagery yet, and a
 * stock photograph of somebody else's factory on a government site is worse
 * than none. So the visual is the subject itself — two meshing gears on a
 * drafting grid — in the brand's own colours, built in SVG so it is crisp at
 * any size and costs nothing to download.
 */
function EngineeringHero({ site, stats, bitac, services }: { site: any; stats: Stats; bitac: any; services: ServiceRow[] }) {
    return (
        <section className="relative overflow-hidden bg-brand-950">
            <div className="absolute inset-0 bg-blueprint" />
            <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-brand-600/30 blur-3xl" />
            <div className="absolute top-1/3 -right-32 w-[30rem] h-[30rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand-950 to-transparent" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-28 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 animate-fade-in">
                    <div className="inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-white/[0.07] border border-white/10 text-white/80 text-xs font-semibold backdrop-blur">
                        <span className="px-2.5 py-1 rounded-full bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider">Since 1962</span>
                        {bitac?.ministry_bn || 'Ministry of Industries'} · Government of Bangladesh
                    </div>

                    <h1 className="mt-7 text-4xl sm:text-5xl lg:text-[3.6rem] font-extrabold text-white leading-[1.08] tracking-tight">
                        <HeroTitle text={site?.hero_title} />
                    </h1>

                    <p className="text-base sm:text-lg text-white/65 mt-6 leading-relaxed max-w-xl">
                        {site?.hero_subtitle}
                    </p>

                    <div className="mt-10 flex flex-wrap items-center gap-3">
                        <Link href="/portfolio/services"
                              className="group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-sm font-bold shadow-xl shadow-brand-600/30 transition-all">
                            Explore our services
                            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                                <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                            </span>
                        </Link>
                        <Link href="/portfolio/contact"
                              className="inline-flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-white text-sm font-bold backdrop-blur transition-colors">
                            <i className="fi fi-rr-paper-plane text-sm leading-none" />
                            Request a quotation
                        </Link>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13px] text-white/55">
                        {['Import-substitute manufacturing', 'Industrial training', 'Testing & R&D'].map(t => (
                            <span key={t} className="inline-flex items-center gap-2">
                                <i className="fi fi-rr-badge-check text-brand-300 text-sm leading-none" />{t}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-5 hidden lg:block">
                    <GearVisual stats={stats} services={services} />
                </div>
            </div>

            <StatsStrip stats={stats} />
        </section>
    );
}

/**
 * The last two words of the headline in the brand gradient — the one bit of
 * colour in the type. A headline of one or two words is set plain.
 */
function HeroTitle({ text }: { text?: string }) {
    const words = (text ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) return <>{text}</>;

    const head = words.slice(0, -2).join(' ');
    const tail = words.slice(-2).join(' ');
    return (
        <>
            {head}{' '}
            <span className="bg-gradient-to-r from-brand-300 via-fuchsia-300 to-brand-200 bg-clip-text text-transparent">
                {tail}
            </span>
        </>
    );
}

/**
 * Two meshing gears on the grid, with what BITAC does floating over them.
 *
 * ⚠️ The cards name the service lines, NOT the figures. The figures are in
 * the strip directly underneath, and the first version had "64+ / 18+ / 1"
 * on the same screen twice. With fewer than three services the figures stand
 * in, so the visual is never left with empty slots.
 */
function GearVisual({ stats, services }: { stats: Stats; services: ServiceRow[] }) {
    const spots = ['top-[8%] -left-6', 'bottom-[18%] -left-12 delay', 'bottom-[2%] right-0'];
    const cards = services.length >= 3
        ? services.slice(0, 3).map((x, i) => (
            <FloatCard key={x.id} className={spots[i]} icon={x.icon_class} label="Service" title={x.title} />
        ))
        : [
            <FloatCard key="y" className={spots[0]} icon="fi-rr-time-past" value={`${stats.years}+`} label="Years of service" />,
            <FloatCard key="c" className={spots[1]} icon="fi-rr-marker" value={String(stats.centres)} label="Centres nationwide" />,
            <FloatCard key="k" className={spots[2]} icon="fi-rr-users-alt" value={`${stats.clients}+`} label="Clients served" />,
        ];

    return (
        <div className="relative aspect-square max-w-[30rem] mx-auto">
            <div className="absolute inset-8 rounded-full border border-dashed border-white/10" />
            <div className="absolute inset-20 rounded-full border border-white/[0.06]" />

            <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
                <defs>
                    <linearGradient id="gearA" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--brand-400, 149 100 206))" />
                        <stop offset="100%" stopColor="rgb(var(--brand-700, 79 39 124))" />
                    </linearGradient>
                    <linearGradient id="gearB" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--brand-200, 218 202 236))" />
                        <stop offset="100%" stopColor="rgb(var(--brand-500, 118 58 187))" />
                    </linearGradient>
                </defs>
                {/* The large gear and the small one sit so their teeth mesh,
                    and turn opposite ways at the inverse of their size. */}
                <g className="gear-turn">
                    <path d={gearPath(170, 200, 112, 94, 14)} fill="url(#gearA)" fillRule="evenodd" opacity="0.95" />
                </g>
                <g className="gear-turn-rev">
                    <path d={gearPath(300, 118, 62, 50, 8)} fill="url(#gearB)" fillRule="evenodd" opacity="0.9" />
                </g>
                <circle cx="170" cy="200" r="22" fill="rgb(var(--brand-950, 29 13 48))" />
                <circle cx="300" cy="118" r="12" fill="rgb(var(--brand-950, 29 13 48))" />
            </svg>

            {cards}
        </div>
    );
}

/**
 * A gear outline as one SVG path: `teeth` trapezoids on an outer radius,
 * with a centre bore cut out (even-odd fill). Drawn here rather than shipped
 * as an asset so its colours come from the brand variables.
 */
function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
    const step = (Math.PI * 2) / teeth;
    const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    const parts: string[] = [];
    for (let i = 0; i < teeth; i++) {
        const a = i * step;
        parts.push(
            (i === 0 ? 'M' : 'L') + pt(inner, a),
            'L' + pt(outer, a + step * 0.18),
            'L' + pt(outer, a + step * 0.42),
            'L' + pt(inner, a + step * 0.6),
        );
    }
    const bore = inner * 0.42;
    return parts.join(' ') + ' Z '
        + `M${cx + bore},${cy} A${bore},${bore} 0 1,0 ${cx - bore},${cy} A${bore},${bore} 0 1,0 ${cx + bore},${cy} Z`;
}

function FloatCard({ className, icon, value, title, label }: {
    className: string; icon: string; value?: string; title?: string; label: string;
}) {
    return (
        <div className={`absolute float-slow ${className}`}>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-950/70 border border-white/15 backdrop-blur-md pl-3 pr-5 py-3 shadow-2xl shadow-black/40 max-w-[17rem]">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shrink-0">
                    <i className={`fi ${icon} text-base leading-none`} />
                </span>
                <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-brand-300">{label}</span>
                    {value ? (
                        <span className="block text-xl font-extrabold text-white tabular-nums leading-none mt-1">{value}</span>
                    ) : (
                        <span className="block text-[13px] font-bold text-white leading-snug mt-0.5">{title}</span>
                    )}
                </span>
            </div>
        </div>
    );
}

/** The institution's figures, along the hero's lower edge. */
function StatsStrip({ stats }: { stats: Stats }) {
    const items: [string, string, string][] = [
        ['fi-rr-time-past', `${stats.years}+`, 'Years of service'],
        ['fi-rr-settings', String(stats.projects), 'Products on display'],
        ['fi-rr-users-alt', `${stats.clients}+`, 'Clients served'],
        ['fi-rr-marker', String(stats.centres), 'Centres nationwide'],
    ];
    return (
        <div className="relative border-t border-white/10 bg-black/25 backdrop-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 divide-white/10 lg:divide-x">
                {items.map(([icon, value, label]) => (
                    <div key={label} className="flex items-center gap-4 py-7 lg:px-8 first:lg:pl-0">
                        <span className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 text-brand-300 flex items-center justify-center shrink-0">
                            <i className={`fi ${icon} text-lg leading-none`} />
                        </span>
                        <span>
                            <span className="block text-3xl font-extrabold text-white tabular-nums leading-none">{value}</span>
                            <span className="block text-[11px] text-white/50 mt-1.5 uppercase tracking-wider font-semibold">{label}</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Process ──────────────────────────────────────────────────────────────

const STEPS: [string, string, string][] = [
    ['fi-rr-paper-plane', 'Enquiry', 'Send the drawing, sample or specification with the quantity you need.'],
    ['fi-rr-calculator', 'Costing & quotation', 'Priced part by part and issued as a formal, approved quotation.'],
    ['fi-rr-diploma', 'Work order', 'Your order is accepted, planned and routed through the shops.'],
    ['fi-rr-settings', 'Production & QC', 'Machined, fabricated and finished — then inspected before it leaves.'],
    ['fi-rr-truck-side', 'Delivery & bill', 'Delivered against a challan, then billed with the VAT challan.'],
];

function Process() {
    return (
        <div className="relative">
            {/* The line the steps sit on — desktop only, where they are in a row. */}
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent" />
            <ol className="relative grid sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
                {STEPS.map(([icon, title, text], i) => (
                    <li key={title} className="group text-center">
                        <span className="relative mx-auto w-16 h-16 rounded-2xl bg-white border border-brand-200 shadow-lg shadow-brand-500/10 flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white group-hover:border-brand-600 group-hover:-translate-y-1 transition-all duration-300">
                            <i className={`fi ${icon} text-xl leading-none`} />
                            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-950 text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-4 ring-white">
                                {i + 1}
                            </span>
                        </span>
                        <h3 className="text-sm font-bold text-surface-900 mt-5">{title}</h3>
                        <p className="text-[13px] text-surface-500 mt-2 leading-relaxed max-w-[15rem] mx-auto">{text}</p>
                    </li>
                ))}
            </ol>
        </div>
    );
}

// ── News ─────────────────────────────────────────────────────────────────

/** The newest post large, the rest as a list beside it. */
function NewsLayout({ news }: { news: NewsRow[] }) {
    const [lead, ...rest] = news;
    return (
        <div className="grid md:grid-cols-2 gap-5">
            <Link href={`/portfolio/news/${lead.slug}`}
                  className="group relative rounded-3xl overflow-hidden bg-brand-950 min-h-[18rem] flex flex-col justify-end p-7">
                {lead.cover_url ? (
                    <img src={lead.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <span className="absolute inset-0 bg-blueprint" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-transparent" />
                <span className="relative">
                    <KindBadge kind={lead.kind} />
                    <span className="block text-xl font-bold text-white mt-3 leading-snug group-hover:text-brand-200 transition-colors">{lead.title}</span>
                    {lead.excerpt && <span className="block text-sm text-white/65 mt-2 line-clamp-2">{lead.excerpt}</span>}
                    <span className="block text-[11px] text-white/45 mt-3">{lead.event_date || lead.published}</span>
                </span>
            </Link>
            {rest.length > 0 && (
                <div className="divide-y divide-surface-200">
                    {rest.map(n => (
                        <Link key={n.slug} href={`/portfolio/news/${n.slug}`} className="group block py-4 first:pt-0">
                            <span className="flex items-center gap-2">
                                <KindBadge kind={n.kind} />
                                <span className="text-[11px] text-surface-400">{n.event_date || n.published}</span>
                            </span>
                            <span className="block text-sm font-bold text-surface-900 mt-2 leading-snug group-hover:text-brand-700 transition-colors line-clamp-2">
                                {n.title}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function EventRow({ e }: { e: NewsRow }) {
    const [day, month] = (e.event_date ?? '').split(' ');
    return (
        <Link href={`/portfolio/news/${e.slug}`}
              className="group flex gap-4 p-4 rounded-2xl bg-surface-50 border border-surface-200 hover:border-brand-300 hover:bg-white hover:shadow-md transition-all">
            <span className="w-14 h-14 shrink-0 rounded-xl bg-brand-600 text-white flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold leading-none">{day}</span>
                <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5 text-brand-100">{month}</span>
            </span>
            <span className="min-w-0">
                <span className="block text-[13px] font-bold text-surface-900 leading-snug line-clamp-2 group-hover:text-brand-700">{e.title}</span>
                {e.location && (
                    <span className="block text-[11px] text-surface-500 mt-1">
                        <i className="fi fi-rr-marker text-[9px] mr-1" />{e.location}
                    </span>
                )}
            </span>
        </Link>
    );
}

// ── Clients ──────────────────────────────────────────────────────────────

/**
 * Two rows sliding opposite ways. Each track holds its list TWICE and moves by
 * half its own width (`.marquee-track`), so the wrap never shows a seam.
 * Paused on hover so a name can be read; stopped for reduced motion.
 */
function ClientMarquee({ clients }: { clients: { name: string; type: string | null }[] }) {
    const half = Math.ceil(clients.length / 2);
    const rows = clients.length > 8 ? [clients.slice(0, half), clients.slice(half)] : [clients];

    return (
        <div className="space-y-4">
            {rows.map((row, r) => (
                <div key={r} className="marquee overflow-hidden">
                    <div className={`marquee-track gap-4 ${r % 2 ? 'reverse' : ''}`}>
                        {[...row, ...row].map((c, i) => (
                            <span key={`${c.name}-${i}`}
                                  aria-hidden={i >= row.length}
                                  className="shrink-0 inline-flex items-center gap-3 pl-2 pr-5 py-2 rounded-2xl bg-surface-50 border border-surface-200 hover:border-brand-300 hover:bg-white transition-colors">
                                <span className="w-9 h-9 rounded-xl bg-white border border-surface-200 text-brand-700 font-extrabold text-sm flex items-center justify-center">
                                    {c.name.charAt(0)}
                                </span>
                                <span className="text-sm font-semibold text-surface-700 whitespace-nowrap">{c.name}</span>
                                {c.type && (
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                        c.type === 'Government' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                                    }`}>
                                        {c.type === 'Government' ? 'Govt' : 'Private'}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Call to action ───────────────────────────────────────────────────────

function CallToAction({ bitac }: { bitac: any }) {
    return (
        <section className="relative overflow-hidden bg-brand-950">
            <div className="absolute inset-0 bg-blueprint" />
            <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[50rem] h-[30rem] rounded-full bg-brand-600/30 blur-3xl" />
            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
                <span className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white items-center justify-center shadow-xl shadow-brand-900/50">
                    <i className="fi fi-rr-industry-windows text-xl leading-none" />
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-7 leading-tight tracking-tight">
                    Have a job for us?
                </h2>
                <p className="text-base sm:text-lg text-white/65 mt-5 max-w-2xl mx-auto leading-relaxed">
                    Send us your drawing, sample or specification. Our engineers cost it part by part and
                    come back with a formal quotation.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <Link href="/portfolio/contact"
                          className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-white text-brand-800 text-sm font-bold hover:bg-brand-50 shadow-xl shadow-black/20 transition-colors">
                        <i className="fi fi-rr-paper-plane text-sm leading-none" />
                        Request a quotation
                    </Link>
                    <a href="/customer/login"
                       className="inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-white text-sm font-bold backdrop-blur transition-colors">
                        <i className="fi fi-rr-briefcase text-sm leading-none" />
                        Customer login
                    </a>
                </div>
                {(bitac?.phone || bitac?.email) && (
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/55">
                        {(bitac?.phone_bn || bitac?.phone) && (
                            <span className="inline-flex items-center gap-2">
                                <i className="fi fi-rr-phone-call text-brand-300" />{bitac.phone_bn || bitac.phone}
                            </span>
                        )}
                        {bitac?.email && (
                            <a href={`mailto:${bitac.email}`} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                                <i className="fi fi-rr-envelope text-brand-300" />{bitac.email}
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

// ── Buttons ──────────────────────────────────────────────────────────────

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href}
              className="group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/25 transition-all">
            {children}
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <i className="fi fi-rr-arrow-small-right text-base leading-none" />
            </span>
        </Link>
    );
}

function GhostButton({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
    return (
        <Link href={href}
              className="inline-flex items-center gap-2.5 px-6 py-4 rounded-2xl border border-surface-300 hover:border-brand-400 hover:bg-brand-50 text-surface-700 hover:text-brand-700 text-sm font-bold transition-colors">
            <i className={`fi ${icon} text-xs leading-none`} />
            {children}
        </Link>
    );
}
