import { Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, GalleryRow, NewsCard, NewsRow, Project, ProjectCard, Prose, Section, SectionHead } from './parts';
import HeroSlider, { HeroSlide } from '@/Components/Public/HeroSlider';
import { ServiceRow } from './Services';

interface Props {
    slides: HeroSlide[];
    featured: Project[];
    services: ServiceRow[];
    news: NewsRow[];
    events: NewsRow[];
    photos: GalleryRow[];
    clients: { name: string; type: string | null }[];
    stats: { years: number; projects: number; clients: number; centres: number };
    bitac: any;
    site: any;
    links: any;
}

export default function Home({ slides, featured, services, news, events, photos, clients, stats, bitac, site, links }: Props) {
    return (
        <PublicLayout title="BITAC — Bangladesh Industrial Technical Assistance Centre" bitac={bitac} links={links}>
            {/* ── Hero ─────────────────────────────────────────────────── */}
            {slides.length > 0 ? (
                <HeroSlider slides={slides} fallbackTitle={site?.hero_title} fallbackSubtitle={site?.hero_subtitle}>
                    {/* Figures sit on the hero's edge so the first screen already
                        says how big the institution is. */}
                    <div className="relative border-t border-white/10 bg-black/20 backdrop-blur">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-8 text-white">
                            {[
                                [`${stats.years}+`, 'Years of service'],
                                [stats.projects, 'Projects on display'],
                                [`${stats.clients}+`, 'Clients served'],
                                [stats.centres, 'Centres nationwide'],
                            ].map(([v, l]) => (
                                <div key={String(l)}>
                                    <div className="text-3xl sm:text-4xl font-extrabold tabular-nums">{v}</div>
                                    <div className="text-[11px] text-surface-400 mt-1 uppercase tracking-wider font-semibold">{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </HeroSlider>
            ) : (
                /* No slides uploaded yet — the gradient hero stands in, so the
                   front page is never a blank black band. */
                <section className="relative overflow-hidden bg-brand-950">
                    {/* A quiet engineering texture rather than a stock photo we do
                        not have — a broken <img> would be worse than none. */}
                    <div className="absolute inset-0 opacity-[0.07]"
                         style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
                    <div className="absolute -top-24 -right-24 w-[32rem] h-[32rem] rounded-full bg-brand-500/20 blur-3xl" />

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-brand-300 text-[11px] font-bold uppercase tracking-[0.15em] mb-6 backdrop-blur">
                                <i className="fi fi-rr-industry-windows text-[11px] leading-none" />
                                Since 1962 · Government of Bangladesh
                            </div>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1]">
                                {site?.hero_title}
                            </h1>
                            <p className="text-base sm:text-lg text-surface-300 mt-6 leading-relaxed max-w-2xl">
                                {site?.hero_subtitle}
                            </p>
                            <div className="mt-9 flex flex-wrap items-center gap-3">
                                <Link href="/portfolio/services"
                                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition-colors shadow-lg shadow-brand-500/25">
                                    Our Services
                                    <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                                </Link>
                                <Link href="/portfolio/contact"
                                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold backdrop-blur transition-colors">
                                    <i className="fi fi-rr-envelope text-sm leading-none" />
                                    Contact Us
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Figures sit on the hero's edge so the first screen already
                        says how big the institution is. */}
                    <div className="relative border-t border-white/10 bg-black/20 backdrop-blur">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-8 text-white">
                            {[
                                [`${stats.years}+`, 'Years of service'],
                                [stats.projects, 'Projects on display'],
                                [`${stats.clients}+`, 'Clients served'],
                                [stats.centres, 'Centres nationwide'],
                            ].map(([v, l]) => (
                                <div key={String(l)}>
                                    <div className="text-3xl sm:text-4xl font-extrabold tabular-nums">{v}</div>
                                    <div className="text-[11px] text-surface-400 mt-1 uppercase tracking-wider font-semibold">{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── About ────────────────────────────────────────────────── */}
            <Section>
                <div className="grid lg:grid-cols-5 gap-10 items-start">
                    <div className="lg:col-span-3">
                        {/* No `action` on the heading: a "Read more" tucked up
                            beside the title sits above the thing it carries on
                            from, so it reads as a label rather than the next
                            step. It belongs under the text, as a button. */}
                        <SectionHead eyebrow="About BITAC" title="A national centre for industrial capability" />
                        <p className="text-[15px] text-surface-700 leading-[1.8]">{site?.about_lead}</p>
                        <Prose text={site?.about_body} className="text-sm text-surface-600 leading-[1.9] mt-4" />
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <Link href="/portfolio/about"
                                  className="group inline-flex items-center gap-2.5 pl-5 pr-4 py-3 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white text-sm font-bold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all">
                                Read more about BITAC
                                <span className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                                    <i className="fi fi-rr-arrow-small-right text-sm leading-none" />
                                </span>
                            </Link>
                            <Link href="/portfolio/contact"
                                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-surface-300 hover:border-brand-400 hover:bg-brand-50 text-surface-700 hover:text-brand-700 text-sm font-bold transition-colors">
                                <i className="fi fi-rr-envelope text-xs leading-none" />
                                Talk to us
                            </Link>
                        </div>
                    </div>
                    <div className="lg:col-span-2 rounded-2xl bg-surface-50 border border-surface-200 p-6">
                        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-600 mb-3">Our mission</div>
                        <p className="text-sm text-surface-700 leading-relaxed">{site?.mission}</p>
                        {services.length > 0 && (
                            <div className="mt-6 space-y-3">
                                {services.map(x => (
                                    <Link key={x.id} href="/portfolio/services"
                                          className="flex items-center gap-3 text-sm text-surface-700 hover:text-brand-700 transition-colors group">
                                        <span className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center shrink-0 group-hover:border-brand-300">
                                            <i className={`fi ${x.icon_class} text-brand-600 text-sm leading-none`} />
                                        </span>
                                        {x.title}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Section>

            {/* ── Services ─────────────────────────────────────────────── */}
            {services.length > 0 && (
                <Section tint>
                    <SectionHead eyebrow="What we do" title="Services"
                                 lead="Four things BITAC does for industry, under one roof."
                                 action={{ href: '/portfolio/services', label: 'All services' }} />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {services.map(x => (
                            <Link key={x.id} href="/portfolio/services"
                                  className="group p-6 rounded-2xl bg-white border border-surface-200 hover:border-brand-300 hover:shadow-lg transition-all">
                                <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                                    <i className={`fi ${x.icon_class} text-base leading-none`} />
                                </span>
                                <h3 className="text-sm font-bold text-surface-900 leading-snug group-hover:text-brand-700 transition-colors">
                                    {x.title}
                                </h3>
                                {x.summary && (
                                    <p className="text-xs text-surface-600 mt-2 leading-relaxed line-clamp-4">{x.summary}</p>
                                )}
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            {/* ── Products ─────────────────────────────────────────────── */}
            <Section>
                <SectionHead eyebrow="What we make" title="Manufactured products & recent work"
                             lead="Precision components and overhaul work delivered for Railway, power, sugar and private industry."
                             action={{ href: '/portfolio/products', label: 'All products' }} />
                {featured.length ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {featured.map(p => <ProjectCard key={p.id} p={p} />)}
                    </div>
                ) : (
                    <Empty icon="fi-rr-settings" title="No products published yet"
                           text="Published portfolio projects appear here." />
                )}
            </Section>

            {/* ── News & events ────────────────────────────────────────── */}
            <Section tint>
                <div className="grid lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2">
                        <SectionHead eyebrow="Newsroom" title="News & notices"
                                     action={{ href: '/portfolio/news', label: 'All news' }} />
                        {news.length ? (
                            <div className="space-y-4">{news.map(n => <NewsCard key={n.slug} n={n} />)}</div>
                        ) : (
                            <Empty icon="fi-rr-newspaper" title="No news published yet"
                                   text="Posts added under Admin → Website appear here." />
                        )}
                    </div>
                    <div>
                        <SectionHead eyebrow="Diary" title="Upcoming events" />
                        {events.length ? (
                            <div className="space-y-3">
                                {events.map(e => (
                                    <Link key={e.slug} href={`/portfolio/news/${e.slug}`}
                                          className="flex gap-3 p-3.5 rounded-xl bg-surface-50 border border-surface-200 hover:border-brand-300 transition-colors group">
                                        <div className="w-12 shrink-0 text-center">
                                            <div className="text-[10px] uppercase font-bold text-brand-600">
                                                {e.event_date?.split(' ')[1]}
                                            </div>
                                            <div className="text-xl font-extrabold text-surface-900 leading-none">
                                                {e.event_date?.split(' ')[0]}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-bold text-surface-900 leading-snug line-clamp-2 group-hover:text-brand-700">
                                                {e.title}
                                            </div>
                                            {e.location && (
                                                <div className="text-[11px] text-surface-500 mt-1">
                                                    <i className="fi fi-rr-marker text-[9px] mr-1" />{e.location}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <Empty icon="fi-rr-calendar" title="Nothing scheduled" />
                        )}
                    </div>
                </div>
            </Section>

            {/* ── Clients ──────────────────────────────────────────────── */}
            <Section>
                <SectionHead eyebrow="Who we serve" title="Our clients"
                             lead="Government bodies and private industry across Bangladesh."
                             action={{ href: '/portfolio/clients', label: 'All clients' }} />
                {clients.length ? (
                    <div className="flex flex-wrap gap-2.5">
                        {clients.map(c => (
                            <span key={c.name}
                                  className="px-4 py-2.5 rounded-xl bg-white border border-surface-200 text-sm font-semibold text-surface-700">
                                {c.name}
                            </span>
                        ))}
                    </div>
                ) : (
                    <Empty icon="fi-rr-building" title="No clients listed yet" />
                )}
            </Section>

            {/* ── Gallery ──────────────────────────────────────────────── */}
            {photos.length > 0 && (
                <Section tint>
                    <SectionHead eyebrow="Gallery" title="Inside BITAC"
                                 action={{ href: '/portfolio/gallery', label: 'Photo gallery' }} />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {photos.slice(0, 8).map(g => (
                            <div key={g.id} className="aspect-square rounded-xl overflow-hidden bg-surface-100">
                                {g.image_url && (
                                    <img src={g.image_url} alt={g.title ?? ''} loading="lazy"
                                         className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* ── Call to action ───────────────────────────────────────── */}
            <section className="bg-gradient-to-r from-brand-600 to-brand-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Have a job for us?</h2>
                        <p className="text-sm text-white/80 mt-2 max-w-xl">
                            Send us your drawing or specification and our engineers will come back with a quotation.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Link href="/portfolio/contact"
                              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-700 text-sm font-bold hover:bg-surface-50 transition-colors">
                            <i className="fi fi-rr-paper-plane text-sm leading-none" />
                            Contact Us
                        </Link>
                        <a href="/customer/login"
                           className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-700/40 hover:bg-brand-700/60 text-white text-sm font-bold backdrop-blur transition-colors">
                            <i className="fi fi-rr-briefcase text-sm leading-none" />
                            Customer Login
                        </a>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
