import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';

/**
 * The repeated furniture of the public site.
 *
 * One definition each, because eight pages each rolling their own section
 * heading is how a site stops looking like one site.
 */

export interface Project {
    id: number;
    slug: string;
    title: string;
    client_name: string | null;
    category: string | null;
    summary: string | null;
    completed_at: string | null;
    cover_image_url: string | null;
}

export interface NewsRow {
    slug: string;
    title: string;
    kind: string;
    excerpt: string | null;
    cover_url: string | null;
    event_date: string | null;
    location: string | null;
    published: string | null;
}

export interface GalleryRow {
    id: number;
    kind: string;
    title: string | null;
    caption: string | null;
    album: string | null;
    image_url: string | null;
    embed_url: string | null;
    thumb_url: string | null;
    taken_on: string | null;
}

/**
 * Split stored copy into paragraphs.
 *
 * ⚠️ The text comes from a settings row or a PHP heredoc and can arrive with
 * EITHER line ending. On a CRLF file the separator is "\r\n\r\n", which
 * /\n{2,}/ never matches — the whole thing then renders as one slab of text,
 * which is exactly what happened the first time.
 */
export function splitParagraphs(text?: string | null): string[] {
    return (text ?? '').split(/\r?\n[ \t]*\r?\n/).map(p => p.trim()).filter(Boolean);
}

/** Stored copy, set as paragraphs rather than one block. */
export function Prose({ text, className = '' }: { text?: string | null; className?: string }) {
    const paras = splitParagraphs(text);
    if (!paras.length) return null;

    return (
        <div className={`space-y-4 ${className}`}>
            {paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
    );
}

/** A page's own title band — every inner page opens with one. */
export function PageHead({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
    return (
        <section className="bg-gradient-to-br from-brand-950 via-brand-950 to-brand-800/70 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
                {eyebrow && (
                    <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-brand-400 mb-3">{eyebrow}</div>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight max-w-3xl">{title}</h1>
                {lead && <p className="text-surface-300 mt-4 max-w-2xl leading-relaxed">{lead}</p>}
            </div>
        </section>
    );
}

/** A heading inside a page, with an optional link off to the full list. */
export function SectionHead({ eyebrow, title, lead, action }: {
    eyebrow?: string; title: string; lead?: string; action?: { href: string; label: string };
}) {
    return (
        <div className="flex items-end justify-between gap-6 mb-8">
            <div className="max-w-2xl">
                {eyebrow && (
                    <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-600 mb-2">{eyebrow}</div>
                )}
                <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 leading-tight">{title}</h2>
                {lead && <p className="text-sm text-surface-600 mt-3 leading-relaxed">{lead}</p>}
            </div>
            {action && (
                <Link href={action.href}
                      className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 shrink-0 pb-1">
                    {action.label}
                    <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                </Link>
            )}
        </div>
    );
}

export function Section({ children, tint = false, className = '' }: {
    children: ReactNode; tint?: boolean; className?: string;
}) {
    return (
        <section className={`${tint ? 'bg-surface-50' : 'bg-white'} ${className}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">{children}</div>
        </section>
    );
}

/** A figure that says something about the institution. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
    return (
        <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-surface-900 tabular-nums">{value}</div>
            <div className="text-xs text-surface-500 mt-1 uppercase tracking-wider font-semibold">{label}</div>
        </div>
    );
}

/** A piece of work BITAC has done. */
export function ProjectCard({ p }: { p: Project }) {
    return (
        <Link href={`/portfolio/${p.slug}`}
              className="group block rounded-2xl overflow-hidden bg-white border border-surface-200 hover:border-brand-300 hover:shadow-lg transition-all">
            <div className="aspect-[4/3] bg-surface-100 overflow-hidden">
                {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.title} loading="lazy"
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-300">
                        <i className="fi fi-rr-settings text-3xl" />
                    </div>
                )}
            </div>
            <div className="p-5">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider mb-2">
                    {p.category && <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{p.category}</span>}
                    {p.completed_at && <span className="text-surface-400">{p.completed_at}</span>}
                </div>
                <h3 className="text-[15px] font-bold text-surface-900 leading-snug group-hover:text-brand-700 transition-colors">
                    {p.title}
                </h3>
                {p.client_name && (
                    <div className="text-xs text-surface-500 mt-1">For {p.client_name}</div>
                )}
                {p.summary && (
                    <p className="text-xs text-surface-600 mt-2.5 leading-relaxed line-clamp-2">{p.summary}</p>
                )}
            </div>
        </Link>
    );
}

const KIND_TONE: Record<string, string> = {
    news:   'text-sky-700 bg-sky-50',
    event:  'text-violet-700 bg-violet-50',
    notice: 'text-amber-800 bg-amber-50',
    tender: 'text-emerald-700 bg-emerald-50',
};

export function KindBadge({ kind }: { kind: string }) {
    return (
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${KIND_TONE[kind] ?? 'text-surface-600 bg-surface-100'}`}>
            {kind}
        </span>
    );
}

export function NewsCard({ n }: { n: NewsRow }) {
    return (
        <Link href={`/portfolio/news/${n.slug}`}
              className="group flex gap-4 p-4 rounded-2xl bg-white border border-surface-200 hover:border-brand-300 hover:shadow-md transition-all">
            {n.cover_url && (
                <img src={n.cover_url} alt="" loading="lazy"
                     className="w-24 h-24 rounded-xl object-cover shrink-0" />
            )}
            <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <KindBadge kind={n.kind} />
                    {/* An event's own date is the thing a reader needs; a
                        notice only has the day it went up. */}
                    <span className="text-[11px] text-surface-400">{n.event_date || n.published}</span>
                </div>
                <h3 className="text-sm font-bold text-surface-900 leading-snug group-hover:text-brand-700 transition-colors line-clamp-2">
                    {n.title}
                </h3>
                {n.excerpt && (
                    <p className="text-xs text-surface-600 mt-1.5 leading-relaxed line-clamp-2">{n.excerpt}</p>
                )}
                {n.location && (
                    <div className="text-[11px] text-surface-500 mt-1.5">
                        <i className="fi fi-rr-marker text-[9px] mr-1" />{n.location}
                    </div>
                )}
            </div>
        </Link>
    );
}

export interface PartnerRow {
    id: number;
    name: string;
    kind: string;
    kind_label: string;
    logo_url: string | null;
    url: string | null;
    note: string | null;
}

/**
 * The collaborators & partners wall.
 *
 * ⚠️ Logos arrive in every shape, colour and aspect ratio there is — a tall
 * crest next to a wide wordmark. They are therefore given a fixed box with
 * `object-contain` and set in grey, lifting to full colour on hover: it is the
 * only treatment under which a dozen unrelated marks read as one row rather
 * than a jumble. Never `object-cover` here — it crops somebody's emblem.
 */
export function PartnerWall({ partners, columns = 'lg:grid-cols-6' }: {
    partners: PartnerRow[]; columns?: string;
}) {
    return (
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${columns} gap-3`}>
            {partners.map(p => {
                const inner = (
                    <>
                        <span className="h-14 flex items-center justify-center">
                            {p.logo_url && (
                                <img
                                    src={p.logo_url}
                                    alt={p.name}
                                    loading="lazy"
                                    className="max-h-14 max-w-full object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                                />
                            )}
                        </span>
                        <span className="block text-[11px] font-semibold text-surface-500 group-hover:text-surface-800 text-center mt-3 leading-snug transition-colors">
                            {p.name}
                        </span>
                        {p.note && (
                            <span className="block text-[10px] text-surface-400 text-center mt-0.5 leading-snug">{p.note}</span>
                        )}
                    </>
                );

                const className = 'group flex flex-col justify-center p-5 rounded-2xl bg-white border border-surface-200 hover:border-brand-300 hover:shadow-md transition-all';

                return p.url ? (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                       title={p.name} className={className}>
                        {inner}
                    </a>
                ) : (
                    <div key={p.id} className={className}>{inner}</div>
                );
            })}
        </div>
    );
}

/** Nothing here yet — said plainly, rather than an empty strip of page. */
export function Empty({ icon = 'fi-rr-inbox', title, text }: { icon?: string; title: string; text?: string }) {
    return (
        <div className="text-center py-16 rounded-2xl border border-dashed border-surface-300 bg-surface-50/60">
            <i className={`fi ${icon} text-3xl text-surface-300`} />
            <div className="text-sm font-bold text-surface-700 mt-3">{title}</div>
            {text && <div className="text-xs text-surface-500 mt-1 max-w-md mx-auto">{text}</div>}
        </div>
    );
}
