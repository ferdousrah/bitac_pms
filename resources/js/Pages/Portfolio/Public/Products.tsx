import { useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, PageHead, Project, ProjectCard, Section } from './parts';

interface Props { projects: Project[]; categories: string[]; bitac: any; site: any; links: any }

export default function Products({ projects, categories, bitac, links }: Props) {
    const [cat, setCat] = useState<string | null>(null);
    const [q, setQ] = useState('');

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return projects.filter((p) =>
            (!cat || p.category === cat) &&
            (!needle || [p.title, p.client_name, p.summary, p.category]
                .filter(Boolean).join(' ').toLowerCase().includes(needle))
        );
    }, [projects, cat, q]);

    return (
        <PublicLayout title="Products — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="What we make"
                title="Manufactured products"
                lead="Precision components, overhaul and fabrication delivered for government and private industry."
            />

            <Section>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setCat(null)}
                            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                !cat ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                        >
                            All ({projects.length})
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCat(c)}
                                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    cat === c ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                }`}
                            >
                                {c} ({projects.filter((p) => p.category === c).length})
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-72">
                        <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search products…"
                            aria-label="Search products"
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-300 text-sm outline-none focus:border-brand-400"
                        />
                    </div>
                </div>

                {shown.length ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shown.map((p) => <ProjectCard key={p.id} p={p} />)}
                    </div>
                ) : (
                    <Empty icon="fi-rr-search" title="Nothing matches" text="Try another capability area, or clear the search." />
                )}
            </Section>
        </PublicLayout>
    );
}
