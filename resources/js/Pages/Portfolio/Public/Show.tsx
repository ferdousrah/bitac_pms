import { Link } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import PublicLayout, { BitacInfo, SiteLinkRow } from '@/Layouts/PublicLayout';
import { categoryIcon, Project, ProjectCard, Prose, Section, SectionHead } from './parts';

interface Spec { label: string; value: string }
interface Photo { id: number; url: string; caption: string | null }
interface Detail {
    id: number;
    slug: string;
    title: string;
    client_name: string | null;
    category: string | null;
    summary: string | null;
    description: string | null;
    specs: Spec[];
    completed_at: string | null;
    cover_image_url: string | null;
    photos: Photo[];
}
interface Props {
    project: Detail;
    related: Project[];
    bitac: BitacInfo;
    links?: Record<string, SiteLinkRow[]>;
}

const BN = '০১২৩৪৫৬৭৮৯';
const telHref = (n: string) => 'tel:' + n.replace(/[০-৯]/g, d => String(BN.indexOf(d))).replace(/[^\d+]/g, '');

/**
 * One piece of work BITAC has made — `/portfolio/{slug}`, reached from
 * Products. Same language as the rest of the site: an ink page head with the
 * picture beside the title, the story and photographs, the specs in a sticky
 * sidebar with a way to ask for the same thing, and more work underneath.
 */
export default function PortfolioPublicShow({ project, related, bitac, links }: Props) {
    const [open, setOpen] = useState<number | null>(null);
    const photos = project.photos;
    const phone = (bitac?.phone_bn || bitac?.phone || '').split(/[,;]/)[0]?.trim();

    const step = useCallback((d: number) => setOpen(i => (i === null ? null : (i + d + photos.length) % photos.length)), [photos.length]);

    // The lightbox answers the keyboard: Esc closes, the arrows page.
    useEffect(() => {
        if (open === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(null);
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, step]);

    // The category is not a fact chip: the breadcrumb and the eyebrow already say it.
    const facts: [string, string, string | null][] = [
        ['fi-rr-building', 'Client', project.client_name],
        ['fi-rr-calendar', 'Completed', project.completed_at],
    ];

    return (
        <PublicLayout title={`${project.title} — BITAC`} bitac={bitac} links={links}>
            {/* ── Head: the title beside the picture ───────────────────────── */}
            <section className="relative overflow-hidden bg-ink-950 text-white">
                <div className="absolute inset-0 bg-blueprint" />
                <div className="absolute -top-32 right-0 w-[34rem] h-[34rem] rounded-full bg-brand-600/20 blur-3xl" />
                <div className="absolute -bottom-40 left-1/4 w-[26rem] h-[26rem] rounded-full bg-amber-500/[0.06] blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pb-20">
                    <nav className="flex items-center gap-2 text-xs text-white/50 mb-8" aria-label="Breadcrumb">
                        <Link href="/portfolio" className="hover:text-white transition-colors">Home</Link>
                        <i className="fi fi-rr-angle-small-right text-[10px] leading-none" />
                        <Link href="/portfolio/products" className="hover:text-white transition-colors">Products</Link>
                        {project.category && (
                            <>
                                <i className="fi fi-rr-angle-small-right text-[10px] leading-none" />
                                <span className="text-white/70">{project.category}</span>
                            </>
                        )}
                    </nav>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                        <div className="lg:col-span-6">
                            {project.category && (
                                <div className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] font-bold text-amber-300">
                                    <span className="h-px w-8 bg-amber-400" />{project.category}
                                </div>
                            )}
                            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold leading-[1.1] mt-4">{project.title}</h1>
                            {project.summary && (
                                <p className="text-[17px] text-white/70 mt-5 leading-relaxed max-w-xl">{project.summary}</p>
                            )}
                            <div className="mt-8 flex flex-wrap gap-3">
                                {facts.filter(([, , v]) => v).map(([icon, label, value]) => (
                                    <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3">
                                        <span className="w-9 h-9 rounded-xl bg-white/[0.07] text-amber-300 flex items-center justify-center shrink-0">
                                            <i className={`fi ${icon} text-sm leading-none`} />
                                        </span>
                                        <span>
                                            <span className="block text-[10px] uppercase tracking-[0.16em] font-bold text-white/45">{label}</span>
                                            <span className="block text-sm font-semibold text-white mt-0.5">{value}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-6">
                            {project.cover_image_url ? (
                                <div className="aspect-[4/3] rounded-3xl overflow-hidden ring-1 ring-white/10 bg-ink-900">
                                    <img src={project.cover_image_url} alt={project.title} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                /* No photograph: a drafting sheet with the capability's
                                   icon — the same treatment as the product cards. */
                                <div className="aspect-[4/3] rounded-3xl ring-1 ring-white/10 bg-white/[0.03] relative overflow-hidden flex items-center justify-center">
                                    <div className="absolute inset-0 bg-blueprint opacity-60" />
                                    <div className="relative text-center">
                                        <span className="mx-auto w-24 h-24 rounded-3xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                                            <i className={`fi ${categoryIcon(project.category)} text-4xl text-brand-300 leading-none`} />
                                        </span>
                                        <div className="text-xs text-white/40 mt-4">Photographs to follow</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── The work, its photographs, its numbers ───────────────────── */}
            <Section>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    <div className="lg:col-span-8 space-y-12">
                        {project.description && (
                            <div>
                                <h2 className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-5">
                                    <span className="h-px w-8 bg-brand-500" /> About this work
                                </h2>
                                <Prose text={project.description} className="text-[16px] text-surface-700" />
                            </div>
                        )}

                        {photos.length > 0 && (
                            <div>
                                <h2 className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] font-bold text-brand-600 mb-5">
                                    <span className="h-px w-8 bg-brand-500" /> Photographs
                                    <span className="text-surface-400 normal-case tracking-normal font-semibold">· {photos.length}</span>
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {photos.map((ph, i) => (
                                        <button key={ph.id} type="button" onClick={() => setOpen(i)}
                                                className={`group relative rounded-2xl overflow-hidden bg-surface-100 ${i === 0 && photos.length > 2 ? 'col-span-2 row-span-2 aspect-square sm:aspect-auto' : 'aspect-square'}`}>
                                            <img src={ph.url} alt={ph.caption ?? `Photo ${i + 1}`} loading="lazy"
                                                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <span className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/35 transition-colors flex items-center justify-center">
                                                <i className="fi fi-rr-expand text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </span>
                                            {ph.caption && (
                                                <span className="absolute left-0 right-0 bottom-0 px-3 py-2 text-left text-xs text-white bg-gradient-to-t from-ink-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {ph.caption}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!project.description && photos.length === 0 && (
                            <p className="text-surface-600">A fuller description of this work will be published here.</p>
                        )}
                    </div>

                    <aside className="lg:col-span-4 lg:sticky lg:top-28 space-y-5">
                        {project.specs.length > 0 && (
                            <div className="rounded-3xl border border-surface-200 bg-white overflow-hidden">
                                <div className="px-6 py-4 border-b border-surface-200 flex items-center gap-2.5">
                                    <span className="w-1.5 h-4 rounded-full bg-brand-600" />
                                    <h3 className="text-base font-bold text-surface-900">Technical specifications</h3>
                                </div>
                                <dl className="divide-y divide-surface-100">
                                    {project.specs.map((sp, i) => (
                                        <div key={i} className="px-6 py-3.5 grid grid-cols-5 gap-3">
                                            <dt className="col-span-2 text-xs font-semibold uppercase tracking-wider text-surface-500 pt-0.5">{sp.label}</dt>
                                            <dd className="col-span-3 text-sm font-semibold text-surface-900">{sp.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}

                        <div className="relative rounded-3xl overflow-hidden bg-ink-900 text-white p-6">
                            <div className="absolute inset-0 bg-blueprint opacity-60" />
                            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-600/30 blur-3xl" />
                            <div className="relative">
                                <h3 className="text-lg font-bold leading-snug">Need something like this made?</h3>
                                <p className="text-sm text-white/65 mt-2 leading-relaxed">
                                    Send the drawing, a sample or the specification — BITAC costs it and sends a formal quotation.
                                </p>
                                <Link href="/portfolio/request-quotation"
                                      className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors">
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" /> Request a quotation
                                </Link>
                                {phone && (
                                    <a href={telHref(phone)} className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                                        <i className="fi fi-rr-phone-call text-xs leading-none text-amber-300" /> or call {phone}
                                    </a>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </Section>

            {/* ── More work ─────────────────────────────────────────────────── */}
            {related.length > 0 && (
                <Section tint>
                    <SectionHead eyebrow="Products" title="More of our work"
                                 action={{ href: '/portfolio/products', label: 'All products' }} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {related.map(p => <ProjectCard key={p.id} p={p} />)}
                    </div>
                </Section>
            )}

            {/* ── Lightbox ──────────────────────────────────────────────────── */}
            {open !== null && photos[open] && (
                <div className="fixed inset-0 z-[200] bg-ink-950/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(null)}>
                    <button type="button" onClick={() => setOpen(null)} aria-label="Close"
                            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                        <i className="fi fi-rr-cross text-sm leading-none" />
                    </button>
                    {photos.length > 1 && (
                        <>
                            <button type="button" onClick={e => { e.stopPropagation(); step(-1); }} aria-label="Previous"
                                    className="absolute left-3 sm:left-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                                <i className="fi fi-rr-angle-left text-base leading-none" />
                            </button>
                            <button type="button" onClick={e => { e.stopPropagation(); step(1); }} aria-label="Next"
                                    className="absolute right-3 sm:right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                                <i className="fi fi-rr-angle-right text-base leading-none" />
                            </button>
                        </>
                    )}
                    <figure className="max-w-5xl" onClick={e => e.stopPropagation()}>
                        <img src={photos[open].url} alt={photos[open].caption ?? ''} className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
                        <figcaption className="text-center mt-4">
                            {photos[open].caption && <span className="block text-sm text-white/85">{photos[open].caption}</span>}
                            <span className="block text-xs text-white/45 mt-1 tabular-nums">{open + 1} / {photos.length}</span>
                        </figcaption>
                    </figure>
                </div>
            )}
        </PublicLayout>
    );
}
