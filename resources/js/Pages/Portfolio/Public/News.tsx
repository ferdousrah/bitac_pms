import { useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, NewsCard, NewsRow, PageHead, Section } from './parts';

interface Props { posts: NewsRow[]; bitac: any; site: any; links: any }

const KINDS = ['news', 'event', 'notice', 'tender'] as const;

export default function News({ posts, bitac, links }: Props) {
    const [kind, setKind] = useState<string | null>(null);
    const [q, setQ] = useState('');

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return posts.filter((p) =>
            (!kind || p.kind === kind) &&
            (!needle || [p.title, p.excerpt, p.location].filter(Boolean).join(' ').toLowerCase().includes(needle))
        );
    }, [posts, kind, q]);

    return (
        <PublicLayout title="News & Events — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="Newsroom"
                title="News & Events"
                lead="Announcements, notices, tenders and events from BITAC."
            />

            <Section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setKind(null)}
                            className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                                !kind ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                        >
                            All ({posts.length})
                        </button>
                        {KINDS.map((k) => {
                            const n = posts.filter((p) => p.kind === k).length;
                            if (!n) return null;
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setKind(k)}
                                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                                        kind === k ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                    }`}
                                >
                                    {k} ({n})
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search news…"
                            aria-label="Search news"
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-300 text-sm outline-none focus:border-brand-400"
                        />
                    </div>
                </div>

                {shown.length ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {shown.map((n) => <NewsCard key={n.slug} n={n} />)}
                    </div>
                ) : (
                    <Empty
                        icon="fi-rr-newspaper"
                        title={posts.length ? 'Nothing matches' : 'No posts published yet'}
                        text={posts.length ? 'Try another category, or clear the search.' : 'News, notices and events added under Admin → Website appear here.'}
                    />
                )}
            </Section>
        </PublicLayout>
    );
}
