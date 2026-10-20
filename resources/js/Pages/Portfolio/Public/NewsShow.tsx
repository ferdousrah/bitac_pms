import { Link } from '@inertiajs/react';
import PublicLayout from '@/Layouts/PublicLayout';
import { KindBadge, NewsCard, NewsRow, Section } from './parts';

interface Props {
    post: {
        title: string; kind: string; excerpt: string | null; body: string | null;
        cover_url: string | null; event_date: string | null; location: string | null; published: string | null;
    };
    more: NewsRow[];
    bitac: any; site: any; links: any;
}

export default function NewsShow({ post, more, bitac, links }: Props) {
    return (
        <PublicLayout title={`${post.title} — BITAC`} bitac={bitac} links={links}>
            <article>
                <header className="bg-ink-950 text-white">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
                        <Link href="/portfolio/news" className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white mb-6">
                            <i className="fi fi-rr-arrow-small-left text-base leading-none" />
                            News &amp; Events
                        </Link>
                        <div className="flex items-center gap-3 mb-4">
                            <KindBadge kind={post.kind} />
                            <span className="text-xs text-surface-400">{post.event_date || post.published}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{post.title}</h1>
                        {post.location && (
                            <div className="text-sm text-surface-300 mt-4">
                                <i className="fi fi-rr-marker text-xs mr-1.5" />{post.location}
                            </div>
                        )}
                    </div>
                </header>

                {post.cover_url && (
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
                        <img src={post.cover_url} alt="" className="w-full rounded-2xl shadow-xl object-cover max-h-[28rem]" />
                    </div>
                )}

                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {post.excerpt && (
                        <p className="text-lg text-surface-700 leading-relaxed mb-6">{post.excerpt}</p>
                    )}
                    {post.body && (
                        // ⚠️ Rendered as TEXT, not HTML. Nothing on this page is
                        // sanitised on the way in, and it is served to the public
                        // — dangerouslySetInnerHTML here would be a stored-XSS
                        // hole on BITAC's own website.
                        <div className="text-sm text-surface-700 leading-[1.9] whitespace-pre-line">
                            {post.body}
                        </div>
                    )}
                </div>
            </article>

            {more.length > 0 && (
                <Section tint>
                    <h2 className="text-xl font-bold text-surface-900 mb-6">More from BITAC</h2>
                    <div className="grid lg:grid-cols-2 gap-4">
                        {more.map((n) => <NewsCard key={n.slug} n={n} />)}
                    </div>
                </Section>
            )}
        </PublicLayout>
    );
}
