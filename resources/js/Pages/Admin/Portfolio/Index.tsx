import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Project {
    id: number;
    slug: string;
    title: string;
    client_name: string | null;
    category: string | null;
    summary: string | null;
    completed_at: string | null;
    is_published: boolean;
    display_order: number;
    cover_image_url: string | null;
    photo_count: number;
}

interface Props {
    projects: { data: Project[]; current_page: number; last_page: number; from: number; to: number; total: number; links: any[] };
    filters: { search: string };
}

export default function AdminPortfolioIndex({ projects, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');

    const onSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get('/admin/portfolio', { search }, { preserveState: true });
    };

    const togglePublish = (id: number) => {
        router.post(`/admin/portfolio/${id}/toggle-publish`, {}, { preserveScroll: true });
    };

    const remove = (id: number, title: string) => {
        if (!confirm(`Delete "${title}"? This removes the project and all its photos permanently.`)) return;
        router.delete(`/admin/portfolio/${id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="Portfolio">
            <div className="space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Portfolio</h1>
                        <p className="page-subtitle">Public-facing project showcase · {projects.total} project{projects.total === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href="/portfolio" target="_blank" rel="noopener noreferrer" className="btn-outline">
                            <i className="fi fi-rr-eye text-xs leading-none" /> View Public Site
                        </a>
                        <Link href="/admin/portfolio/create" className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New Project
                        </Link>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <form onSubmit={onSearch} className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm leading-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by title, client, or category…"
                                    className="form-input pl-9"
                                />
                            </div>
                            <button type="submit" className="btn-primary">Search</button>
                        </form>
                    </div>
                </div>

                {projects.data.length === 0 ? (
                    <div className="card">
                        <div className="card-body py-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
                                <i className="fi fi-rr-folder-open text-surface-400 text-2xl" />
                            </div>
                            <div className="text-base font-bold text-surface-900">No projects yet</div>
                            <p className="text-xs text-surface-500 mt-1 mb-4">Create your first project to start building the public portfolio.</p>
                            <Link href="/admin/portfolio/create" className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> New Project
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.data.map(p => (
                            <div key={p.id} className="card group">
                                <div className="aspect-[4/3] bg-surface-100 overflow-hidden rounded-t-2xl relative">
                                    {p.cover_image_url ? (
                                        <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-surface-300">
                                            <i className="fi fi-rr-picture text-4xl" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2">
                                        {p.is_published ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                                <i className="fi fi-sr-globe text-[9px] leading-none" /> Published
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-700 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                                <i className="fi fi-sr-eye-crossed text-[9px] leading-none" /> Hidden
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        {p.category && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                                                {p.category}
                                            </span>
                                        )}
                                        {p.completed_at && (
                                            <span className="text-[10px] text-surface-400">{p.completed_at}</span>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-bold text-surface-900 line-clamp-2">{p.title}</h3>
                                    {p.client_name && (
                                        <div className="text-xs text-surface-500 mt-0.5">{p.client_name}</div>
                                    )}
                                    <div className="text-[11px] text-surface-400 mt-2 flex items-center gap-2">
                                        <span><i className="fi fi-rr-picture text-[9px] leading-none mr-0.5" /> {p.photo_count} photos</span>
                                        <span>·</span>
                                        <span className="font-mono">order #{p.display_order}</span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-surface-100">
                                        <Link
                                            href={`/admin/portfolio/${p.id}/edit`}
                                            className="flex-1 text-center px-3 py-1.5 rounded-lg bg-surface-50 hover:bg-brand-50 hover:text-brand-700 text-xs font-semibold text-surface-700 transition-colors"
                                        >
                                            <i className="fi fi-rr-pencil text-[10px] leading-none mr-1" /> Edit
                                        </Link>
                                        <button
                                            onClick={() => togglePublish(p.id)}
                                            className={`flex-1 text-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                p.is_published
                                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                            }`}
                                        >
                                            <i className={`fi ${p.is_published ? 'fi-rr-eye-crossed' : 'fi-rr-globe'} text-[10px] leading-none mr-1`} />
                                            {p.is_published ? 'Unpublish' : 'Publish'}
                                        </button>
                                        <button
                                            onClick={() => remove(p.id, p.title)}
                                            className="px-2.5 py-1.5 rounded-lg bg-surface-50 hover:bg-red-50 hover:text-red-600 text-xs text-surface-400 transition-colors"
                                            title="Delete project"
                                        >
                                            <i className="fi fi-rr-trash text-[10px] leading-none" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
