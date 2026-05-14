import { Link } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';

interface Project {
    id: number;
    slug: string;
    title: string;
    client_name: string | null;
    category: string | null;
    summary: string | null;
    completed_at: string | null;
    cover_image_url: string | null;
}

interface Props {
    projects: Project[];
    categories: string[];
    bitac: any;
}

export default function PortfolioPublicIndex({ projects, categories, bitac }: Props) {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (!activeCategory) return projects;
        return projects.filter(p => p.category === activeCategory);
    }, [projects, activeCategory]);

    return (
        <PublicLayout title="BITAC Portfolio" bitac={bitac}>
            {/* Hero — BITAC intro */}
            <section className="bg-gradient-to-br from-brand-50 via-white to-emerald-50/40 border-b border-surface-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold uppercase tracking-wider mb-4">
                            <i className="fi fi-rr-industry-windows text-[10px] leading-none" />
                            Since 1962 · Government of Bangladesh
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-surface-900 leading-tight">
                            Engineering precision for Bangladesh's industry.
                        </h1>
                        <p className="text-base text-surface-600 mt-4 leading-relaxed">
                            BITAC has delivered import-substitute manufacturing, training, testing, and R&amp;D
                            to Railway, BPDB, Petrobangla, sugar mills, and private industry for over six decades.
                            Explore some of our recent work below.
                        </p>
                        <div className="mt-6 flex items-center gap-4 text-xs text-surface-500">
                            <span><strong className="text-surface-900 text-base">{projects.length}</strong> projects on display</span>
                            <span>·</span>
                            <span><strong className="text-surface-900 text-base">{categories.length}</strong> capability areas</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Category filter + project grid */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {categories.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                !activeCategory ? 'bg-brand-500 text-white' : 'bg-white text-surface-600 border border-surface-200 hover:border-brand-300'
                            }`}
                        >
                            All ({projects.length})
                        </button>
                        {categories.map(cat => {
                            const count = projects.filter(p => p.category === cat).length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                        activeCategory === cat ? 'bg-brand-500 text-white' : 'bg-white text-surface-600 border border-surface-200 hover:border-brand-300'
                                    }`}
                                >
                                    {cat} ({count})
                                </button>
                            );
                        })}
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
                            <i className="fi fi-rr-folder-open text-surface-400 text-2xl" />
                        </div>
                        <div className="text-base font-semibold text-surface-700">No projects to display yet</div>
                        <div className="text-xs text-surface-500 mt-1">Check back soon — we're adding to the gallery regularly.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(p => (
                            <Link
                                key={p.id}
                                href={`/portfolio/${p.slug}`}
                                className="group bg-white rounded-2xl overflow-hidden border border-surface-100 hover:border-brand-300 hover:shadow-lg transition-all"
                            >
                                <div className="aspect-[4/3] bg-surface-100 overflow-hidden">
                                    {p.cover_image_url ? (
                                        <img
                                            src={p.cover_image_url}
                                            alt={p.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-surface-300">
                                            <i className="fi fi-rr-picture text-4xl" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        {p.category && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                                                {p.category}
                                            </span>
                                        )}
                                        {p.completed_at && (
                                            <span className="text-[10px] text-surface-400 font-medium">{p.completed_at}</span>
                                        )}
                                    </div>
                                    <h3 className="text-base font-bold text-surface-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                                        {p.title}
                                    </h3>
                                    {p.client_name && (
                                        <div className="text-xs text-surface-500 mt-1 font-medium">For {p.client_name}</div>
                                    )}
                                    {p.summary && (
                                        <p className="text-sm text-surface-600 mt-2 line-clamp-3 leading-relaxed">{p.summary}</p>
                                    )}
                                    <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-2 transition-all">
                                        View details
                                        <i className="fi fi-rr-arrow-small-right text-[10px] leading-none" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </PublicLayout>
    );
}
