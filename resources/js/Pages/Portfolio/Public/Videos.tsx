import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, GalleryRow, PageHead, Section } from './parts';

interface Props { videos: GalleryRow[]; bitac: any; site: any; links: any }

export default function Videos({ videos, bitac, links }: Props) {
    const [playing, setPlaying] = useState<number | null>(null);

    return (
        <PublicLayout title="Video Gallery — BITAC" bitac={bitac} links={links}>
            <PageHead eyebrow="Gallery" title="Video Gallery" lead="BITAC at work — machining, fabrication, training and events." />

            <Section>
                {videos.length ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((v) => (
                            <div key={v.id} className="rounded-2xl overflow-hidden bg-white border border-surface-200">
                                <div className="aspect-video bg-surface-900 relative">
                                    {/* ⚠️ The iframe is only mounted once someone
                                        asks to watch. Twelve autoloaded YouTube
                                        players is a page that takes seconds to
                                        settle and phones home for every visitor. */}
                                    {playing === v.id && v.embed_url ? (
                                        <iframe
                                            src={`${v.embed_url}?autoplay=1`}
                                            title={v.title ?? 'Video'}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setPlaying(v.id)}
                                            aria-label={`Play ${v.title ?? 'video'}`}
                                            className="group w-full h-full relative"
                                        >
                                            {v.thumb_url && (
                                                <img src={v.thumb_url} alt="" loading="lazy"
                                                     className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            )}
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                                                    <i className="fi fi-sr-play text-lg leading-none ml-0.5" />
                                                </span>
                                            </span>
                                        </button>
                                    )}
                                </div>
                                {(v.title || v.caption) && (
                                    <div className="p-4">
                                        {v.title && <h3 className="text-sm font-bold text-surface-900">{v.title}</h3>}
                                        {v.caption && <p className="text-xs text-surface-600 mt-1.5 leading-relaxed">{v.caption}</p>}
                                        {v.taken_on && <div className="text-[11px] text-surface-400 mt-2">{v.taken_on}</div>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty icon="fi-rr-play" title="No videos yet"
                           text="Videos added under Admin → Website appear here." />
                )}
            </Section>
        </PublicLayout>
    );
}
