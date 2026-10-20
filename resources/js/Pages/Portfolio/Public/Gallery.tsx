import { useEffect, useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, GalleryRow, PageHead, Section } from './parts';

interface Props { photos: GalleryRow[]; albums: string[]; bitac: any; site: any; links: any }

export default function Gallery({ photos, albums, bitac, links }: Props) {
    const [album, setAlbum] = useState<string | null>(null);
    const [open, setOpen] = useState<number | null>(null);

    const shown = useMemo(
        () => (album ? photos.filter((p) => p.album === album) : photos),
        [photos, album],
    );

    // A lightbox that cannot be closed with Escape, or stepped through with the
    // arrow keys, is a picture you are trapped in.
    useEffect(() => {
        if (open === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(null);
            if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % shown.length));
            if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, shown.length]);

    const current = open !== null ? shown[open] : null;

    return (
        <PublicLayout title="Photo Gallery — BITAC" bitac={bitac} links={links}>
            <PageHead eyebrow="Gallery" title="Photo Gallery" lead="Inside BITAC — our shops, machines and people at work." />

            <Section>
                {albums.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-8">
                        <button
                            type="button"
                            onClick={() => { setAlbum(null); setOpen(null); }}
                            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                !album ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                        >
                            All ({photos.length})
                        </button>
                        {albums.map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => { setAlbum(a); setOpen(null); }}
                                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    album === a ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                }`}
                            >
                                {a} ({photos.filter((p) => p.album === a).length})
                            </button>
                        ))}
                    </div>
                )}

                {shown.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {shown.map((g, i) => (
                            <button
                                key={g.id}
                                type="button"
                                onClick={() => setOpen(i)}
                                aria-label={g.title || 'Open photo'}
                                className="group relative aspect-square rounded-xl overflow-hidden bg-surface-100"
                            >
                                {g.image_url && (
                                    <img src={g.image_url} alt={g.title ?? ''} loading="lazy"
                                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                )}
                                {(g.title || g.caption) && (
                                    <span className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-left opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="block text-[11px] font-semibold text-white line-clamp-2">
                                            {g.title || g.caption}
                                        </span>
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <Empty icon="fi-rr-picture" title="No photos yet"
                           text="Photos added under Admin → Website appear here." />
                )}
            </Section>

            {current && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setOpen(null)}
                    role="dialog"
                    aria-modal="true"
                >
                    <button type="button" onClick={() => setOpen(null)} aria-label="Close"
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-xl leading-none" />
                    </button>
                    {shown.length > 1 && (
                        <>
                            <button type="button" aria-label="Previous"
                                    onClick={(e) => { e.stopPropagation(); setOpen((i) => (i! - 1 + shown.length) % shown.length); }}
                                    className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                                <i className="fi fi-rr-angle-small-left text-xl leading-none" />
                            </button>
                            <button type="button" aria-label="Next"
                                    onClick={(e) => { e.stopPropagation(); setOpen((i) => (i! + 1) % shown.length); }}
                                    className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                                <i className="fi fi-rr-angle-small-right text-xl leading-none" />
                            </button>
                        </>
                    )}
                    <figure className="max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
                        {current.image_url && (
                            <img src={current.image_url} alt={current.title ?? ''} className="max-h-[80vh] rounded-xl object-contain" />
                        )}
                        {(current.title || current.caption) && (
                            <figcaption className="text-center text-sm text-white/80 mt-4">
                                {current.title}
                                {current.title && current.caption ? ' — ' : ''}
                                {current.caption}
                            </figcaption>
                        )}
                    </figure>
                </div>
            )}
        </PublicLayout>
    );
}
