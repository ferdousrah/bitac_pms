import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Post {
    id: number;
    title: string;
    kind: string;
    excerpt: string | null;
    body: string | null;
    cover_url: string | null;
    event_date: string | null;
    location: string | null;
    published_at: string | null;
    is_published: boolean;
    sort: number;
}

export default function NewsForm({ post, kinds }: { post: Post | null; kinds: string[] }) {
    const [preview, setPreview] = useState<string | null>(post?.cover_url ?? null);

    const form = useForm<any>({
        title: post?.title ?? '',
        kind: post?.kind ?? 'news',
        excerpt: post?.excerpt ?? '',
        body: post?.body ?? '',
        cover_image: null as File | null,
        event_date: post?.event_date ?? '',
        location: post?.location ?? '',
        published_at: post?.published_at ?? '',
        is_published: post?.is_published ?? false,
        sort: post?.sort ?? 0,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (post) {
            // A file upload with PUT needs Laravel's method spoofing — the
            // `method` option on post() is ignored.
            form.transform((d: any) => ({ ...d, _method: 'put' }));
            form.post(`/admin/website/news/${post.id}`, { forceFormData: true });
        } else {
            form.post('/admin/website/news', { forceFormData: true });
        }
    };

    const pickCover = (f: File | null) => {
        form.setData('cover_image', f);
        setPreview(f ? URL.createObjectURL(f) : (post?.cover_url ?? null));
    };

    return (
        <AppLayout>
            <Head title={post ? 'Edit Post' : 'New Post'} />

            <div className="max-w-4xl mx-auto animate-fade-in">
                <div className="mb-6">
                    <Link href="/admin/website?tab=news" className="text-xs text-surface-500 hover:text-brand-600">
                        ← Website · News &amp; Events
                    </Link>
                    <h1 className="text-xl font-bold text-surface-900 mt-2">
                        {post ? 'Edit post' : 'New post'}
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Type in Bangla or English — whatever you type is exactly what the website shows.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    <div className="card">
                        <div className="card-body space-y-5">
                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input className="form-input" value={form.data.title}
                                       onChange={(e) => form.setData('title', e.target.value)} />
                                {form.errors.title && <div className="form-error">{form.errors.title}</div>}
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <select className="form-input capitalize" value={form.data.kind}
                                            onChange={(e) => form.setData('kind', e.target.value)}>
                                        {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Event date</label>
                                    <input type="date" className="form-input" value={form.data.event_date}
                                           onChange={(e) => form.setData('event_date', e.target.value)} />
                                    <div className="text-[11px] text-surface-400 mt-1">For an event — shown instead of the publish date.</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input className="form-input" value={form.data.location}
                                           onChange={(e) => form.setData('location', e.target.value)}
                                           placeholder="BITAC, Tejgaon, Dhaka" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Short summary</label>
                                <textarea className="form-textarea" rows={2} value={form.data.excerpt}
                                          onChange={(e) => form.setData('excerpt', e.target.value)} />
                                <div className="text-[11px] text-surface-400 mt-1">
                                    The line shown on the news list and the home page.
                                </div>
                                {form.errors.excerpt && <div className="form-error">{form.errors.excerpt}</div>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Full text</label>
                                <textarea className="form-textarea font-normal" rows={12} value={form.data.body}
                                          onChange={(e) => form.setData('body', e.target.value)} />
                                <div className="text-[11px] text-surface-400 mt-1">
                                    Plain text — line breaks are kept. HTML is not rendered on the site.
                                </div>
                                {form.errors.body && <div className="form-error">{form.errors.body}</div>}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h2 className="font-semibold text-surface-800">Cover image</h2></div>
                        <div className="card-body">
                            <div className="flex items-start gap-5">
                                <div className="w-40 h-28 rounded-xl bg-surface-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    {preview
                                        ? <img src={preview} alt="" className="w-full h-full object-cover" />
                                        : <i className="fi fi-rr-picture text-2xl text-surface-300" />}
                                </div>
                                <div>
                                    <input type="file" accept="image/*"
                                           onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
                                           className="text-sm" />
                                    <div className="text-[11px] text-surface-400 mt-2">
                                        Optional. Up to 8 MB. Landscape reads best on the list.
                                    </div>
                                    {form.errors.cover_image && <div className="form-error">{form.errors.cover_image}</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h2 className="font-semibold text-surface-800">Publishing</h2></div>
                        <div className="card-body space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={form.data.is_published}
                                       onChange={(e) => form.setData('is_published', e.target.checked)}
                                       className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                                <span className="text-sm text-surface-700">
                                    Publish on the website
                                    <span className="block text-[11px] text-surface-400">
                                        Off keeps it a draft — nothing is visible to the public.
                                    </span>
                                </span>
                            </label>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Publish date</label>
                                    <input type="date" className="form-input" value={form.data.published_at}
                                           onChange={(e) => form.setData('published_at', e.target.value)} />
                                    <div className="text-[11px] text-surface-400 mt-1">
                                        Leave blank for today. A future date holds it back until then.
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Order</label>
                                    <input type="number" min={0} className="form-input" value={form.data.sort}
                                           onChange={(e) => form.setData('sort', Number(e.target.value))} />
                                </div>
                            </div>
                            {post?.is_published && (
                                <div className="alert alert-info text-xs">
                                    This post is already published, so its web address stays as it is even if you
                                    change the title — links already shared keep working.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Link href="/admin/website?tab=news" className="btn-ghost">Cancel</Link>
                        <button type="submit" className="btn-primary" disabled={form.processing}>
                            {form.processing ? 'Saving…' : post ? 'Save changes' : 'Create post'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
