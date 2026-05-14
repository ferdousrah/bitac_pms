import { Link } from '@inertiajs/react';
import { useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';

interface Spec { label: string; value: string }
interface Photo { id: number; url: string; caption: string | null }
interface Project {
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
interface Related {
    slug: string;
    title: string;
    client_name: string | null;
    cover_image_url: string | null;
}
interface Props {
    project: Project;
    related: Related[];
    bitac: any;
}

export default function PortfolioPublicShow({ project, related, bitac }: Props) {
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    const openLightbox = (idx: number) => setLightboxIdx(idx);
    const closeLightbox = () => setLightboxIdx(null);
    const nextPhoto = () => setLightboxIdx(i => (i === null ? null : (i + 1) % project.photos.length));
    const prevPhoto = () => setLightboxIdx(i => (i === null ? null : (i - 1 + project.photos.length) % project.photos.length));

    return (
        <PublicLayout title={`${project.title} — BITAC Portfolio`} bitac={bitac}>
            {/* Breadcrumb */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <Link href="/portfolio" className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-brand-600 font-medium transition-colors">
                    <i className="fi fi-rr-angle-left text-[10px] leading-none" />
                    Back to Portfolio
                </Link>
            </div>

            {/* Hero — title + meta + cover image */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {project.category && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold uppercase tracking-wider">
                                {project.category}
                            </span>
                        )}
                        <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 leading-tight">
                            {project.title}
                        </h1>
                        {project.summary && (
                            <p className="text-base text-surface-600 leading-relaxed">{project.summary}</p>
                        )}
                        <div className="space-y-2 pt-2">
                            {project.client_name && (
                                <div className="flex items-center gap-2 text-sm">
                                    <i className="fi fi-rr-building text-surface-400 text-xs" />
                                    <span className="text-surface-500">Client:</span>
                                    <span className="font-semibold text-surface-900">{project.client_name}</span>
                                </div>
                            )}
                            {project.completed_at && (
                                <div className="flex items-center gap-2 text-sm">
                                    <i className="fi fi-rr-calendar text-surface-400 text-xs" />
                                    <span className="text-surface-500">Completed:</span>
                                    <span className="font-semibold text-surface-900">{project.completed_at}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-3">
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-surface-100 shadow-md">
                            {project.cover_image_url ? (
                                <img src={project.cover_image_url} alt={project.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-surface-300">
                                    <i className="fi fi-rr-picture text-5xl" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Content + Specs */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Description */}
                    <div className="lg:col-span-2">
                        {project.description && (
                            <article className="bg-white rounded-2xl border border-surface-100 p-6 sm:p-8">
                                <h2 className="text-base font-bold text-surface-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <i className="fi fi-rr-document text-brand-500" />
                                    Project Details
                                </h2>
                                <div className="prose prose-sm max-w-none text-surface-700 leading-relaxed whitespace-pre-line">
                                    {project.description}
                                </div>
                            </article>
                        )}
                    </div>

                    {/* Specs sidebar */}
                    {project.specs && project.specs.length > 0 && (
                        <aside>
                            <div className="bg-white rounded-2xl border border-surface-100 p-6 sticky top-4">
                                <h2 className="text-xs font-bold text-surface-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <i className="fi fi-rr-settings text-brand-500" />
                                    Technical Specs
                                </h2>
                                <dl className="space-y-3 text-sm">
                                    {project.specs.map((s, i) => (
                                        <div key={i} className="flex flex-col gap-0.5 pb-3 border-b border-surface-100 last:border-0 last:pb-0">
                                            <dt className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">{s.label}</dt>
                                            <dd className="text-surface-900 font-medium">{s.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </aside>
                    )}
                </div>
            </section>

            {/* Photo gallery */}
            {project.photos.length > 0 && (
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                    <h2 className="text-base font-bold text-surface-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i className="fi fi-rr-pictures text-brand-500" />
                        Gallery
                        <span className="text-xs text-surface-400 font-normal normal-case tracking-normal">({project.photos.length} photos)</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {project.photos.map((photo, idx) => (
                            <button
                                key={photo.id}
                                onClick={() => openLightbox(idx)}
                                className="group aspect-square rounded-xl overflow-hidden bg-surface-100 relative"
                            >
                                <img src={photo.url} alt={photo.caption ?? `Photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <i className="fi fi-rr-expand text-white text-xl" />
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Related projects */}
            {related.length > 0 && (
                <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 mt-8">
                    <h2 className="text-base font-bold text-surface-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i className="fi fi-rr-folder-open text-brand-500" />
                        Related Projects
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {related.map(r => (
                            <Link
                                key={r.slug}
                                href={`/portfolio/${r.slug}`}
                                className="group bg-white rounded-xl overflow-hidden border border-surface-100 hover:border-brand-300 hover:shadow-md transition-all"
                            >
                                <div className="aspect-video bg-surface-100">
                                    {r.cover_image_url && (
                                        <img src={r.cover_image_url} alt={r.title} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="p-3">
                                    <div className="text-sm font-bold text-surface-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                                        {r.title}
                                    </div>
                                    {r.client_name && (
                                        <div className="text-[11px] text-surface-500 mt-0.5">{r.client_name}</div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Lightbox */}
            {lightboxIdx !== null && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                    onClick={closeLightbox}
                >
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                        aria-label="Close"
                    >
                        <i className="fi fi-rr-cross text-base leading-none" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                        className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                        aria-label="Previous"
                    >
                        <i className="fi fi-rr-angle-left text-lg leading-none" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                        className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                        aria-label="Next"
                    >
                        <i className="fi fi-rr-angle-right text-lg leading-none" />
                    </button>
                    <div className="max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={project.photos[lightboxIdx].url}
                            alt={project.photos[lightboxIdx].caption ?? ''}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        />
                        {project.photos[lightboxIdx].caption && (
                            <p className="text-white/80 text-sm text-center mt-3">{project.photos[lightboxIdx].caption}</p>
                        )}
                        <p className="text-white/50 text-xs text-center mt-1">{lightboxIdx + 1} / {project.photos.length}</p>
                    </div>
                </div>
            )}
        </PublicLayout>
    );
}
